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
  const { sendScoreUpdate, claimProgress } = useParentCommunication()
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

  // Runs add up: claim progress = today's run scores since the last claim.
  const claimScore = claimProgress[LEDGER_RUNNER_SLUG] ?? 0
  const claimEnabled = claimScore >= LEDGER_RUNNER_REWARD_THRESHOLD

  const statusTitle =
    gameState === 'playing'
      ? 'Running'
      : gameState === 'gameover'
        ? 'Run ended'
        : 'Ready on the line'

  const statusBody =
    gameState === 'playing'
      ? 'Jump spikes and floor pits (wide pits need double-jump). Slide under low beams. SUPER = one free hit. High runways skip ground hazards.'
      : gameState === 'gameover'
        ? `Final score ${score}. It adds to your claim progress (${claimScore} / ${LEDGER_RUNNER_REWARD_THRESHOLD}) — runs add up.`
        : `Horizontal auto-runner — jump quantum spikes, slide under bad ledgers, dodge floaters. Your runs add up — claim at ${LEDGER_RUNNER_REWARD_THRESHOLD} points in total.`

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
