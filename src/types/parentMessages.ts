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
  /**
   * Server-side claim progress for a game: sum of today's run scores since the
   * last claim (authoritative; the claim unlocks at minScore).
   */
  | { type: 'PROGRESS_UPDATE'; game: string; progress: number; minScore?: number }

/** Messages the arcade posts to the parent portal. */
export type ArcadeToParentMessage =
  | { type: 'GAME_READY' }
  /** runId: one id per run so the portal can add runs up toward the claim. */
  | { type: 'SCORE_UPDATE'; game: string; score: number; runId?: string }
  | { type: 'CLAIM_REQUEST'; game: string; score: number; runId?: string }
  /** Ask the portal to open its wallet (create / unlock) because none is connected. */
  | { type: 'CONNECT_WALLET_REQUEST' }

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

  if (record.type === 'PROGRESS_UPDATE') {
    return (
      typeof record.game === 'string' &&
      record.game.length > 0 &&
      typeof record.progress === 'number' &&
      Number.isFinite(record.progress) &&
      (record.minScore === undefined || typeof record.minScore === 'number')
    )
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
    case 'CONNECT_WALLET_REQUEST':
      return true
    case 'SCORE_UPDATE':
    case 'CLAIM_REQUEST':
      return (
        typeof record.game === 'string' &&
        record.game.length > 0 &&
        typeof record.score === 'number' &&
        Number.isFinite(record.score) &&
        (record.runId === undefined || typeof record.runId === 'string')
      )
    default:
      return false
  }
}
