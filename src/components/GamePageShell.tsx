import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useParentCommunication } from '../hooks/useParentCommunication'

type GamePageShellProps = {
  gameSlug: string
  title: string
  tagline: string
  description: string
  scoreLabel: string
  gameCanvas: ReactNode
  score?: number
  bestScore?: number
  claimScore?: number
  claimEnabled?: boolean
  rewardThreshold?: number
  statusTitle?: string
  statusBody?: string
  gameStateLabel?: string
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
  const {
    isConnected,
    isEmbedded,
    sendClaimRequest,
    lastClaimResult,
    clearClaimResult,
  } = useParentCommunication()
  const [playFocus, setPlayFocus] = useState(false)
  const [showNewBest, setShowNewBest] = useState(false)
  const [claimPending, setClaimPending] = useState(false)
  const prevBest = useRef(0)
  const scoreForClaim = claimScore ?? score

  const handleClaim = useCallback(() => {
    if (!claimEnabled || !isConnected || claimPending) return
    setClaimPending(true)
    clearClaimResult()
    sendClaimRequest(gameSlug, scoreForClaim)
  }, [
    claimEnabled,
    isConnected,
    claimPending,
    clearClaimResult,
    gameSlug,
    scoreForClaim,
    sendClaimRequest,
  ])

  useEffect(() => {
    if (!lastClaimResult || lastClaimResult.game !== gameSlug) return
    setClaimPending(false)
    // Auto-fade claim success/error so it doesn't stick forever
    const ms = lastClaimResult.ok ? 4500 : 6000
    const t = window.setTimeout(() => {
      clearClaimResult()
    }, ms)
    return () => window.clearTimeout(t)
  }, [lastClaimResult, gameSlug, clearClaimResult])

  const canClaim = claimEnabled && isConnected
  const progressScore = Math.max(score, bestScore ?? 0, scoreForClaim)
  const thresholdMet =
    rewardThreshold !== undefined
      ? progressScore >= rewardThreshold
      : claimEnabled
  const progressPct =
    rewardThreshold !== undefined
      ? Math.min(100, (progressScore / rewardThreshold) * 100)
      : 0

  // Session "New Best!" toast when React-side best climbs
  useEffect(() => {
    if (bestScore === undefined) return
    if (bestScore > prevBest.current && prevBest.current > 0) {
      setShowNewBest(true)
      const t = window.setTimeout(() => setShowNewBest(false), 1800)
      prevBest.current = bestScore
      return () => window.clearTimeout(t)
    }
    if (bestScore > prevBest.current) prevBest.current = bestScore
  }, [bestScore])

  useEffect(() => {
    if (!playFocus) return
    document.body.classList.add('play-focus-open')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlayFocus(false)
    }
    window.addEventListener('keydown', onKey)
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

  const claimClass = `claim-button${canClaim ? ' claim-button--ready claim-button--pulse' : ''}${
    thresholdMet && !canClaim ? ' claim-button--threshold' : ''
  }`

  const defaultStatusBody = isEmbedded
    ? 'Embedded mode: wallet + claims sync via the parent portal.'
    : 'Standalone mode: mock wallet is available for local development.'

  return (
    <section
      className={`page-panel page-panel--game${playFocus ? ' page-panel--play-focus' : ''}`}
    >
      {showNewBest ? (
        <div className="new-best-toast" role="status">
          New Best!
        </div>
      ) : null}

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
              <strong className="play-chrome__score-value">{score}</strong>
            </div>
            <button
              type="button"
              className={`${claimClass} play-chrome__claim`}
              disabled={!canClaim || claimPending}
              onClick={handleClaim}
            >
              {claimPending ? '…' : canClaim ? 'Claim' : claimLabel}
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

            <div className="score-display score-display--premium">
              <span className="game-meta__label">{scoreLabel}</span>
              <strong>{score}</strong>
              {bestScore !== undefined && bestScore > 0 ? (
                <p className="page-copy score-best">Best this session: {bestScore}</p>
              ) : null}
              {rewardThreshold !== undefined ? (
                <div
                  className={`threshold-meter${thresholdMet ? ' threshold-meter--complete' : ''}`}
                  aria-label="Reward threshold progress"
                >
                  <div className="threshold-meter__header">
                    <span>Claim threshold</span>
                    <span>
                      {Math.min(progressScore, rewardThreshold)} / {rewardThreshold}
                    </span>
                  </div>
                  <div className="threshold-meter__track">
                    <div
                      className="threshold-meter__fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="page-copy">
                    {thresholdMet
                      ? 'Threshold reached — claim when your wallet is connected.'
                      : 'Score keeps counting for the epoch leaderboard after the threshold.'}
                  </p>
                </div>
              ) : (
                <p className="page-copy">
                  Score tracking plugs into wallet rewards via the portal.
                </p>
              )}
            </div>

            <button
              type="button"
              className={claimClass}
              disabled={!canClaim || claimPending}
              onClick={handleClaim}
            >
              {claimPending ? 'Claiming…' : claimLabel}
            </button>

            {lastClaimResult && lastClaimResult.game === gameSlug ? (
              <p
                className="page-copy claim-hint claim-hint--toast"
                role="status"
                style={{
                  color: lastClaimResult.ok ? '#4ade80' : '#f87171',
                }}
              >
                {lastClaimResult.ok
                  ? `Claimed${lastClaimResult.amount != null ? ` ${lastClaimResult.amount} FALCON` : ''}${lastClaimResult.txHash ? ` · ${lastClaimResult.txHash.slice(0, 10)}…` : ''}`
                  : lastClaimResult.error ?? 'Claim failed'}
              </p>
            ) : null}

            {!isConnected ? (
              <p className="page-copy claim-hint">
                {isEmbedded
                  ? 'Open the Falcon Ledger Arcade page with your wallet so claims can pay from the faucet.'
                  : 'Use Connect Wallet in the header (standalone mock) for local UI tests. Real claims need the portal.'}
              </p>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  )
}
