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
} from '../types/parentMessages'
import {
  getAllowedParentOrigins,
  isAllowedParentOrigin,
  isInIframe,
  resolveOutboundTargetOrigin,
} from '../utils/iframe'

/** Placeholder address used only when running outside an iframe. */
const MOCK_WALLET_ADDRESS = '0xFALC0N...B3TA'

export type ParentCommunicationValue = {
  /** True when the arcade is embedded in a parent frame. */
  isEmbedded: boolean
  /** Connected wallet address, or null when disconnected. */
  address: string | null
  /** Convenience flag for UI. */
  isConnected: boolean
  /**
   * Standalone (non-iframe) mock connect/disconnect.
   * No-ops when embedded — the parent portal owns wallet state.
   */
  connectMockWallet: () => void
  disconnectMockWallet: () => void
  toggleMockWallet: () => void
  /** Notify the parent that the arcade shell is ready to receive wallet context. */
  notifyGameReady: () => void
  /** Push a live score for leaderboard / threshold tracking. */
  sendScoreUpdate: (game: string, score: number) => void
  /** Request a Game Faucet claim for the given game + final score. */
  sendClaimRequest: (game: string, score: number) => void
}

const ParentCommunicationContext =
  createContext<ParentCommunicationValue | null>(null)

function postToParent(
  message: ArcadeToParentMessage,
  trustedParentOrigin: string | null,
  isEmbedded: boolean,
): void {
  if (typeof window === 'undefined') {
    return
  }

  if (!isArcadeToParentMessage(message)) {
    console.warn('[Falcon Arcade] Refusing to post invalid message', message)
    return
  }

  // Standalone local dev: no parent to talk to.
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
  const [trustedParentOrigin, setTrustedParentOrigin] = useState<string | null>(
    null,
  )

  // Keep a ref so the message handler always posts with the latest origin
  // without re-binding listeners on every trusted-origin change.
  const trustedOriginRef = useRef<string | null>(null)
  trustedOriginRef.current = trustedParentOrigin

  const notifyGameReady = useCallback(() => {
    postToParent(
      { type: 'GAME_READY' },
      trustedOriginRef.current,
      isEmbedded,
    )
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
      postToParent(
        { type: 'CLAIM_REQUEST', game, score },
        trustedOriginRef.current,
        isEmbedded,
      )
    },
    [isEmbedded],
  )

  const connectMockWallet = useCallback(() => {
    if (isEmbedded) {
      return
    }
    setAddress(MOCK_WALLET_ADDRESS)
  }, [isEmbedded])

  const disconnectMockWallet = useCallback(() => {
    if (isEmbedded) {
      return
    }
    setAddress(null)
  }, [isEmbedded])

  const toggleMockWallet = useCallback(() => {
    if (isEmbedded) {
      return
    }
    setAddress((current) =>
      current === null ? MOCK_WALLET_ADDRESS : null,
    )
  }, [isEmbedded])

  // Inbound parent messages — always validate origin before trusting data.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      // Only accept messages that look like our protocol.
      if (!isParentToArcadeMessage(event.data)) {
        return
      }

      if (!isAllowedParentOrigin(event.origin)) {
        console.warn(
          '[Falcon Arcade] Ignored message from untrusted origin',
          event.origin,
          {
            allowed: getAllowedParentOrigins(),
          },
        )
        return
      }

      // Remember a verified parent origin for future outbound posts.
      setTrustedParentOrigin(event.origin)

      if (event.data.type === 'WALLET_CONNECTED') {
        setAddress(event.data.address)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // Announce readiness once the shell is mounted so the parent can push wallet state.
  useEffect(() => {
    notifyGameReady()
  }, [notifyGameReady])

  const value = useMemo<ParentCommunicationValue>(
    () => ({
      isEmbedded,
      address,
      isConnected: address !== null,
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

/**
 * Access iframe / parent portal communication and wallet context.
 * Must be used under `ParentCommunicationProvider`.
 */
export function useParentCommunication(): ParentCommunicationValue {
  const context = useContext(ParentCommunicationContext)

  if (context === null) {
    throw new Error(
      'useParentCommunication must be used within ParentCommunicationProvider',
    )
  }

  return context
}
