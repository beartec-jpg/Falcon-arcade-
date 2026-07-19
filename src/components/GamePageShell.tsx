import type { ReactNode } from 'react'

type GamePageShellProps = {
  title: string
  tagline: string
  description: string
  scoreLabel: string
  gameCanvas: ReactNode
}

export function GamePageShell({
  title,
  tagline,
  description,
  scoreLabel,
  gameCanvas,
}: GamePageShellProps) {
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
            </p>
          </div>

          <div className="score-display">
            <span className="game-meta__label">{scoreLabel}</span>
            <strong>0</strong>
            <p className="page-copy">
              Score tracking will plug into wallet rewards once gameplay is live.
            </p>
          </div>

          <button type="button" className="claim-button" disabled>
            Claim Reward
          </button>
        </aside>
      </div>
    </section>
  )
}
