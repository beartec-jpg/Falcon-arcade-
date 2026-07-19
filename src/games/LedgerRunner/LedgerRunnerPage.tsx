import { useCallback, useEffect, useRef, useState } from 'react'
import { GamePageShell } from '../../components/GamePageShell'
import { useParentCommunication } from '../../hooks/useParentCommunication'
import { getGameDefinition } from '../../utils/games'
import {
  LEDGER_RUNNER_REWARD_THRESHOLD,
  LEDGER_RUNNER_SLUG,
  type LedgerRunnerGameState,
} from './ledgerRunnerConfig'
import { LedgerRunnerGame } from './LedgerRunnerGame'

const ledgerRunner = getGameDefinition('ledger-runner')

export function LedgerRunnerPage() {
  const { sendScoreUpdate } = useParentCommunication()
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameState, setGameState] = useState<LedgerRunnerGameState>('ready')
  const lastSentScore = useRef(-1)

  const handleScoreChange = useCallback(
    (next: number) => {
      setScore(next)
      setBestScore((prev) => Math.max(prev, next))

      if (next !== lastSentScore.current) {
        lastSentScore.current = next
        sendScoreUpdate(LEDGER_RUNNER_SLUG, next)
      }
    },
    [sendScoreUpdate],
  )

  const handleStateChange = useCallback((state: LedgerRunnerGameState) => {
    setGameState(state)
  }, [])

  useEffect(() => {
    return () => {
      if (lastSentScore.current >= 0) {
        sendScoreUpdate(LEDGER_RUNNER_SLUG, lastSentScore.current)
      }
    }
  }, [sendScoreUpdate])

  const claimScore = Math.max(score, bestScore)
  const claimEnabled = claimScore >= LEDGER_RUNNER_REWARD_THRESHOLD

  const statusTitle =
    gameState === 'playing'
      ? 'Running'
      : gameState === 'gameover'
        ? 'Run ended'
        : 'Ready on the line'

  const statusBody =
    gameState === 'playing'
      ? 'SPACE / tap to jump (double-jump in air). ↓ or tap the bottom of the canvas to slide under bad ledgers. Chain cleans for combos.'
      : gameState === 'gameover'
        ? `Final score ${score}. Reach ${LEDGER_RUNNER_REWARD_THRESHOLD} to unlock the Game Faucet claim for this epoch.`
        : `Horizontal auto-runner — jump quantum spikes, slide under bad ledgers, dodge floaters. Claim unlocks at ${LEDGER_RUNNER_REWARD_THRESHOLD} points.`

  return (
    <GamePageShell
      gameSlug={ledgerRunner.slug}
      title={ledgerRunner.name}
      tagline={ledgerRunner.tagline}
      description={ledgerRunner.longDescription}
      scoreLabel={ledgerRunner.scoreLabel}
      score={score}
      bestScore={bestScore}
      claimScore={claimScore}
      claimEnabled={claimEnabled}
      rewardThreshold={LEDGER_RUNNER_REWARD_THRESHOLD}
      statusTitle={statusTitle}
      statusBody={statusBody}
      gameStateLabel={gameState}
      compactActions
      gameCanvas={
        <LedgerRunnerGame
          onScoreChange={handleScoreChange}
          onStateChange={handleStateChange}
        />
      }
    />
  )
}
