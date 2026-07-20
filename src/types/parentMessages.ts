/**
 * postMessage protocol between Falcon Arcade (iframe) and
 * Falcon Ledger / Falcon-faucet-wallet (parent portal).
 */

/** Messages the parent portal may post into the arcade iframe. */
export type ParentToArcadeMessage =
  | { type: 'WALLET_CONNECTED'; address: string }
  | { type: 'WALLET_DISCONNECTED' }
  | {
      type: 'CLAIM_RESULT'
      game: string
      ok: boolean
      txHash?: string
      amount?: number
      error?: string
    }

/** Messages the arcade posts to the parent portal. */
export type ArcadeToParentMessage =
  | { type: 'GAME_READY' }
  | { type: 'SCORE_UPDATE'; game: string; score: number }
  | { type: 'CLAIM_REQUEST'; game: string; score: number }

export type ClaimResultPayload = Extract<
  ParentToArcadeMessage,
  { type: 'CLAIM_RESULT' }
>

export function isParentToArcadeMessage(
  data: unknown,
): data is ParentToArcadeMessage {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const record = data as Record<string, unknown>

  if (record.type === 'WALLET_CONNECTED') {
    return typeof record.address === 'string' && record.address.length > 0
  }

  if (record.type === 'WALLET_DISCONNECTED') {
    return true
  }

  if (record.type === 'CLAIM_RESULT') {
    return (
      typeof record.game === 'string' &&
      record.game.length > 0 &&
      typeof record.ok === 'boolean'
    )
  }

  return false
}

export function isArcadeToParentMessage(
  data: unknown,
): data is ArcadeToParentMessage {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const record = data as Record<string, unknown>

  switch (record.type) {
    case 'GAME_READY':
      return true
    case 'SCORE_UPDATE':
    case 'CLAIM_REQUEST':
      return (
        typeof record.game === 'string' &&
        record.game.length > 0 &&
        typeof record.score === 'number' &&
        Number.isFinite(record.score)
      )
    default:
      return false
  }
}
