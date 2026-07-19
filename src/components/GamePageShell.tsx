import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParentCommunication } from '../hooks/useParentCommunication'

type GamePageShellProps = {
  /** Game slug used in SCORE_UPDATE / CLAIM_REQUEST messages. */
  gameSlug: string
  title: string
  tagline: string
  description: string
  scoreLabel: string
  gameCanvas: ReactNode
  /** Live score from gameplay. */
  score?: number
  /** Session best (optional display). */
  bestScore?: number
  /**
   * Score sent with CLAIM_REQUEST (defaults to live score).
   * Use session best so a restart after threshold still claims the earned score.
   */
  claimScore?: number
  /** When true (and wallet connected), Claim posts CLAIM_REQUEST. */
  claimEnabled?: boolean
  /** Points needed to unlock claim (shown in UI when set). */
  rewardThreshold?: number
  statusTitle?: string
  statusBody?: string
  gameStateLabel?: string
  /** Hide scaffold “Launch preview / roadmap” actions for live games. */
  compactActions?: boolean
}

export function GamePageShell({
  gameSlug,
  title,
  tagline,
  description,
  scoreLabel,
  gameCanvas,
  score = 0,
  bestScore,
  claimScore,
  claimEnabled = false,
  rewardThreshold,
  statusTitle = 'Scaffolding ready',
  statusBody,
  gameStateLabel,
  compactActions = false,
}: GamePageShellProps) {
  const { isConnected, isEmbedded, sendClaimRequest } = useParentCommunication()
  const [playFocus, setPlayFocus] = useState(false)
  const scoreForClaim = claimScore ?? score

  const handleClaim = useCallback(() => {
    if (!claimEnabled || !isConnected) {
      return
    }
    sendClaimRequest(gameSlug, scoreForClaim)
  }, [claimEnabled, gameSlug, isConnected, scoreForClaim, sendClaimRequest])

  const canClaim = claimEnabled && isConnected
  const progressScore = Math.max(score, bestScore ?? 0, scoreForClaim)
  const thresholdMet =
    rewardThreshold !== undefined
      ? progressScore >= rewardThreshold
      : claimEnabled

  const defaultStatusBody = isEmbedded
    ? 'Embedded mode: wallet + claims sync via the parent portal.'
    : 'Standalone mode: mock wallet is available for local development.'

  // Full-screen play focus: hide site chrome, expand game to the viewport
  useEffect(() => {
    if (!playFocus) return

    document.body.classList.add('play-focus-open')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlayFocus(false)
      }
    }
    window.addEventListener('keydown', onKey)

    // Nudge layout so Phaser Scale.FIT remeasures the parent
    window.dispatchEvent(new Event('resize'))

    return () => {
      document.body.classList.remove('play-focus-open')
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      window.dispatchEvent(new Event('resize'))
    }
  }, [playFocus])

  const claimLabel = canClaim
    ? 'Claim Reward'
    : !isConnected
      ? 'Connect wallet to claim'
      : claimEnabled
        ? 'Claim Reward'
        : rewardThreshold !== undefined
          ? `Reach ${rewardThreshold} to claim`
          : 'Claim Reward'

  return (
    <section
      className={`page-panel page-panel--game${playFocus ? ' page-panel--play-focus' : ''}`}
    >
      {!playFocus ? (
        <header className="game-page-header">
          <div className="game-page-header__copy">
            <span className="section-label">{tagline}</span>
            <h2 className="page-title page-title--game">{title}</h2>
            <p className="page-copy page-copy--tight">{description}</p>
          </div>
          <button
            type="button"
            className="button-primary play-focus-enter"
            onClick={() => setPlayFocus(true)}
          >
            Fullscreen play
          </button>
        </header>
      ) : null}

      {!compactActions && !playFocus ? (
        <div className="page-actions">
          <button type="button" className="button-primary">
            Launch preview
          </button>
          <button type="button" className="button-secondary">
            View roadmap
          </button>
        </div>
      ) : null}

      <div className="game-page">
        <div className="phaser-shell">
          <div className="play-chrome" aria-label="Game controls">
            {playFocus ? (
              <button
                type="button"
                className="button-secondary play-chrome__btn"
                onClick={() => setPlayFocus(false)}
              >
                Exit
              </button>
            ) : (
              <button
                type="button"
                className="button-secondary play-chrome__btn play-chrome__btn--desktop-only"
                onClick={() => setPlayFocus(true)}
              >
                Expand
              </button>
            )}
            <div className="play-chrome__score">
              <span className="game-meta__label">{scoreLabel}</span>
              <strong>{score}</strong>
            </div>
            <button
              type="button"
              className={`claim-button play-chrome__claim${canClaim ? ' claim-button--ready' : ''}`}
              disabled={!canClaim}
              onClick={handleClaim}
            >
              {canClaim ? 'Claim' : claimLabel}
            </button>
          </div>

          <div className="phaser-shell__frame">{gameCanvas}</div>
        </div>

        {!playFocus ? (
          <aside className="game-page__sidebar">
            <div className="meta-card">
              <span className="game-meta__label">Game status</span>
              <strong>{statusTitle}</strong>
              {gameStateLabel ? (
                <span className="status-pill">{gameStateLabel}</span>
              ) : null}
              <p className="page-copy">{statusBody ?? defaultStatusBody}</p>
            </div>

            <div className="score-display">
              <span className="game-meta__label">{scoreLabel}</span>
              <strong>{score}</strong>
              {bestScore !== undefined && bestScore > 0 ? (
                <p className="page-copy score-best">Best this session: {bestScore}</p>
              ) : null}
              {rewardThreshold !== undefined ? (
                <div className="threshold-meter" aria-label="Reward threshold progress">
                  <div className="threshold-meter__header">
                    <span>Claim threshold</span>
                    <span>
                      {Math.min(progressScore, rewardThreshold)} / {rewardThreshold}
                    </span>
                  </div>
                  <div className="threshold-meter__track">
                    <div
                      className="threshold-meter__fill"
                      style={{
                        width: `${Math.min(100, (progressScore / rewardThreshold) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="page-copy">
                    {thresholdMet
                      ? 'Threshold reached — claim is available when your wallet is connected.'
                      : 'Score keeps counting for the epoch leaderboard after the threshold.'}
                  </p>
                </div>
              ) : (
                <p className="page-copy">
                  Score tracking will plug into wallet rewards once gameplay is live.
                </p>
              )}
            </div>

            <button
              type="button"
              className={`claim-button${canClaim ? ' claim-button--ready' : ''}`}
              disabled={!canClaim}
              onClick={handleClaim}
            >
              {claimLabel}
            </button>

            {!isConnected ? (
              <p className="page-copy claim-hint">
                {isEmbedded
                  ? 'Waiting for the parent portal to connect your wallet.'
                  : 'Use Connect Wallet in the header (standalone mock) to enable claims.'}
              </p>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  )
}
