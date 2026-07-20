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

const MOCK_WALLET_ADDRESS = 'rMockFalconArcadeDev000000000000'

export type ParentCommunicationValue = {
  isEmbedded: boolean
  address: string | null
  isConnected: boolean
  lastClaimResult: ClaimResultPayload | null
  clearClaimResult: () => void
  connectMockWallet: () => void
  disconnectMockWallet: () => void
  toggleMockWallet: () => void
  notifyGameReady: () => void
  sendScoreUpdate: (game: string, score: number) => void
  sendClaimRequest: (game: string, score: number) => void
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

  const notifyGameReady = useCallback(() => {
    postToParent({ type: 'GAME_READY' }, trustedOriginRef.current, isEmbedded)
  }, [isEmbedded])

  const sendScoreUpdate = useCallback(
    (game: string, score: number) => {
      postToParent(
        { type: 'SCORE_UPDATE', game, score },
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
        { type: 'CLAIM_REQUEST', game, score },
        trustedOriginRef.current,
        isEmbedded,
      )
    },
    [isEmbedded],
  )

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
      if (event.data.type === 'CLAIM_RESULT') {
        setLastClaimResult(event.data)
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
      clearClaimResult,
      connectMockWallet,
      disconnectMockWallet,
      toggleMockWallet,
      notifyGameReady,
      sendScoreUpdate,
      sendClaimRequest,
    }),
    [
      isEmbedded,
      address,
      lastClaimResult,
      clearClaimResult,
      connectMockWallet,
      disconnectMockWallet,
      toggleMockWallet,
      notifyGameReady,
      sendScoreUpdate,
      sendClaimRequest,
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
