import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  isArcadeToParentMessage,
  isParentToArcadeMessage,
  type ArcadeToParentMessage,
  type ClaimResultPayload,
} from '../types/parentMessages'
import {
  getAllowedParentOrigins,
  isAllowedParentOrigin,
  isInIframe,
  resolveOutboundTargetOrigin,
} from '../utils/iframe'
import {
  ARCADE_CLAIM_THRESHOLD,
  stepRun,
  type RunState,
} from '../utils/claimProgress'

const MOCK_WALLET_ADDRESS = 'rMockFalconArcadeDev000000000000'

export type ParentCommunicationValue = {
  isEmbedded: boolean
  address: string | null
  isConnected: boolean
  lastClaimResult: ClaimResultPayload | null
  /**
   * Claim progress per game: the sum of your runs today since the last claim.
   * The portal's server value replaces the local estimate whenever it arrives.
   */
  claimProgress: Record<string, number>
  clearClaimResult: () => void
  connectMockWallet: () => void
  disconnectMockWallet: () => void
  toggleMockWallet: () => void
  notifyGameReady: () => void
  sendScoreUpdate: (game: string, score: number) => void
  sendClaimRequest: (game: string, score: number) => void
  requestWalletConnect: () => void
}

const ParentCommunicationContext =
  createContext<ParentCommunicationValue | null>(null)

function postToParent(
  message: ArcadeToParentMessage,
  trustedParentOrigin: string | null,
  isEmbedded: boolean,
): void {
  if (typeof window === 'undefined') return

  if (!isArcadeToParentMessage(message)) {
    console.warn('[Falcon Arcade] Refusing to post invalid message', message)
    return
  }

  if (!isEmbedded) {
    if (import.meta.env.DEV) {
      console.debug('[Falcon Arcade] standalone postMessage (no-op)', message)
    }
    return
  }

  const targetOrigin = resolveOutboundTargetOrigin(trustedParentOrigin)

  try {
    window.parent.postMessage(message, targetOrigin)
  } catch (error) {
    console.error('[Falcon Arcade] postMessage to parent failed', error)
  }
}

export function ParentCommunicationProvider({
  children,
}: {
  children: ReactNode
}) {
  const isEmbedded = useMemo(() => isInIframe(), [])

  const [address, setAddress] = useState<string | null>(null)
  const [lastClaimResult, setLastClaimResult] =
    useState<ClaimResultPayload | null>(null)
  const [trustedParentOrigin, setTrustedParentOrigin] = useState<string | null>(
    null,
  )

  const trustedOriginRef = useRef<string | null>(null)
  trustedOriginRef.current = trustedParentOrigin

  const [claimProgress, setClaimProgress] = useState<Record<string, number>>({})
  const runsRef = useRef<Map<string, RunState>>(new Map())

  const notifyGameReady = useCallback(() => {
    postToParent({ type: 'GAME_READY' }, trustedOriginRef.current, isEmbedded)
  }, [isEmbedded])

  const sendScoreUpdate = useCallback(
    (game: string, score: number) => {
      // Each run starts from zero: a lower score than last reported = new run.
      const { run, delta } = stepRun(runsRef.current.get(game), score)
      runsRef.current.set(game, run)
      if (delta > 0) {
        setClaimProgress((p) => ({ ...p, [game]: (p[game] ?? 0) + delta }))
      }
      postToParent(
        { type: 'SCORE_UPDATE', game, score, runId: run.runId },
        trustedOriginRef.current,
        isEmbedded,
      )
    },
    [isEmbedded],
  )

  const sendClaimRequest = useCallback(
    (game: string, score: number) => {
      setLastClaimResult(null)
      postToParent(
        {
          type: 'CLAIM_REQUEST',
          game,
          score,
          runId: runsRef.current.get(game)?.runId,
        },
        trustedOriginRef.current,
        isEmbedded,
      )
    },
    [isEmbedded],
  )

  const requestWalletConnect = useCallback(() => {
    postToParent({ type: 'CONNECT_WALLET_REQUEST' }, trustedOriginRef.current, isEmbedded)
  }, [isEmbedded])

  const clearClaimResult = useCallback(() => {
    setLastClaimResult(null)
  }, [])

  const connectMockWallet = useCallback(() => {
    if (isEmbedded) return
    setAddress(MOCK_WALLET_ADDRESS)
  }, [isEmbedded])

  const disconnectMockWallet = useCallback(() => {
    if (isEmbedded) return
    setAddress(null)
  }, [isEmbedded])

  const toggleMockWallet = useCallback(() => {
    if (isEmbedded) return
    setAddress((current) =>
      current === null ? MOCK_WALLET_ADDRESS : null,
    )
  }, [isEmbedded])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleMessage = (event: MessageEvent) => {
      if (!isParentToArcadeMessage(event.data)) return

      if (!isAllowedParentOrigin(event.origin)) {
        console.warn(
          '[Falcon Arcade] Ignored message from untrusted origin',
          event.origin,
          { allowed: getAllowedParentOrigins() },
        )
        return
      }

      setTrustedParentOrigin(event.origin)

      if (event.data.type === 'WALLET_CONNECTED') {
        setAddress(event.data.address)
        return
      }
      if (event.data.type === 'WALLET_DISCONNECTED') {
        setAddress(null)
        return
      }
      if (event.data.type === 'PROGRESS_UPDATE') {
        const { game, progress } = event.data
        setClaimProgress((p) => ({ ...p, [game]: Math.max(0, progress) }))
        return
      }
      if (event.data.type === 'CLAIM_RESULT') {
        const result = event.data
        setLastClaimResult(result)
        if (result.ok) {
          // A claim consumes the threshold; the portal's PROGRESS_UPDATE corrects this.
          setClaimProgress((p) => ({
            ...p,
            [result.game]: Math.max(0, (p[result.game] ?? 0) - ARCADE_CLAIM_THRESHOLD),
          }))
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    notifyGameReady()
  }, [notifyGameReady])

  const value = useMemo<ParentCommunicationValue>(
    () => ({
      isEmbedded,
      address,
      isConnected: address !== null,
      lastClaimResult,
      claimProgress,
      clearClaimResult,
      connectMockWallet,
      disconnectMockWallet,
      toggleMockWallet,
      notifyGameReady,
      sendScoreUpdate,
      sendClaimRequest,
      requestWalletConnect,
    }),
    [
      isEmbedded,
      address,
      lastClaimResult,
      claimProgress,
      clearClaimResult,
      connectMockWallet,
      disconnectMockWallet,
      toggleMockWallet,
      notifyGameReady,
      sendScoreUpdate,
      sendClaimRequest,
      requestWalletConnect,
    ],
  )

  return createElement(
    ParentCommunicationContext.Provider,
    { value },
    children,
  )
}

export function useParentCommunication(): ParentCommunicationValue {
  const context = useContext(ParentCommunicationContext)

  if (context === null) {
    throw new Error(
      'useParentCommunication must be used within ParentCommunicationProvider',
    )
  }

  return context
}
