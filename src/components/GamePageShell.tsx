import { useCallback, type ReactNode } from 'react'
import { useParentCommunication } from '../hooks/useParentCommunication'

type GamePageShellProps = {
  /** Game slug used in SCORE_UPDATE / CLAIM_REQUEST messages. */
  gameSlug: string
  title: string
  tagline: string
  description: string
  scoreLabel: string
  gameCanvas: ReactNode
  /** Live score from gameplay. Scaffold defaults to 0 until mechanics land. */
  score?: number
  /**
   * When true and the wallet is connected, Claim posts CLAIM_REQUEST
   * to the parent portal. Threshold gating is intentionally not applied yet.
   */
  claimEnabled?: boolean
}

export function GamePageShell({
  gameSlug,
  title,
  tagline,
  description,
  scoreLabel,
  gameCanvas,
  score = 0,
  claimEnabled = false,
}: GamePageShellProps) {
  const { isConnected, isEmbedded, sendClaimRequest, sendScoreUpdate } =
    useParentCommunication()

  const handleClaim = useCallback(() => {
    if (!claimEnabled || !isConnected) {
      return
    }
    sendClaimRequest(gameSlug, score)
  }, [claimEnabled, gameSlug, isConnected, score, sendClaimRequest])

  // Expose score pushes for future Phaser → React bridges without forcing
  // gameplay wiring yet. Calling with the current score is a safe no-op path
  // for integration tests / parent harnesses.
  const handleScoreSync = useCallback(() => {
    sendScoreUpdate(gameSlug, score)
  }, [gameSlug, score, sendScoreUpdate])

  const canClaim = claimEnabled && isConnected

  return (
    <section className="page-panel">
      <span className="section-label">{tagline}</span>
      <h2 className="page-title">{title}</h2>
      <p className="page-copy">{description}</p>

      <div className="page-actions">
        <button type="button" className="button-primary">
          Launch preview
        </button>
        <button type="button" className="button-secondary">
          View roadmap
        </button>
      </div>

      <div className="game-page">
        <div className="phaser-shell">
          <div className="phaser-shell__frame">{gameCanvas}</div>
        </div>

        <aside className="game-page__sidebar">
          <div className="meta-card">
            <span className="game-meta__label">Game loop status</span>
            <strong>Scaffolding ready</strong>
            <p className="page-copy">
              Phaser boots an empty scene for layout and integration work.
              {isEmbedded
                ? ' Embedded mode: wallet + claims sync via the parent portal.'
                : ' Standalone mode: mock wallet is available for local development.'}
            </p>
          </div>

          <div className="score-display">
            <span className="game-meta__label">{scoreLabel}</span>
            <strong>{score}</strong>
            <p className="page-copy">
              Score tracking will plug into wallet rewards once gameplay is live.
            </p>
            {import.meta.env.DEV ? (
              <button
                type="button"
                className="button-secondary"
                onClick={handleScoreSync}
              >
                Sync score to parent
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="claim-button"
            disabled={!canClaim}
            onClick={handleClaim}
          >
            Claim Reward
          </button>
        </aside>
      </div>
    </section>
  )
}
