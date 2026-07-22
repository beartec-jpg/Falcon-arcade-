import { useCallback, useEffect, useRef, useState } from 'react'
import { GamePageShell } from '../../components/GamePageShell'
import { useParentCommunication } from '../../hooks/useParentCommunication'
import { getGameDefinition } from '../../utils/games'
import {
  EPOCH_RISE,
  EPOCH_RISE_REWARD_THRESHOLD,
  EPOCH_RISE_SLUG,
  type EpochRiseGameState,
} from './epochRiseConfig'
import { EpochRiseGame } from './EpochRiseGame'

const epochRise = getGameDefinition('epoch-rise')

export function EpochRisePage() {
  const { sendScoreUpdate } = useParentCommunication()
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [energy, setEnergy] = useState<number>(EPOCH_RISE.maxEnergy)
  const [maxEnergy, setMaxEnergy] = useState<number>(EPOCH_RISE.maxEnergy)
  const [gameState, setGameState] = useState<EpochRiseGameState>('ready')
  const lastSentScore = useRef(-1)

  const handleScoreChange = useCallback(
    (next: number) => {
      setScore(next)
      setBestScore((prev) => Math.max(prev, next))

      if (next !== lastSentScore.current) {
        lastSentScore.current = next
        sendScoreUpdate(EPOCH_RISE_SLUG, next)
      }
    },
    [sendScoreUpdate],
  )

  const handleStateChange = useCallback((state: EpochRiseGameState) => {
    setGameState(state)
  }, [])

  const handleEnergyChange = useCallback((next: number, max: number) => {
    setEnergy(next)
    setMaxEnergy(max)
  }, [])

  useEffect(() => {
    return () => {
      if (lastSentScore.current >= 0) {
        sendScoreUpdate(EPOCH_RISE_SLUG, lastSentScore.current)
      }
    }
  }, [sendScoreUpdate])

  const claimScore = Math.max(score, bestScore)
  const claimEnabled = claimScore >= EPOCH_RISE_REWARD_THRESHOLD
  const energyPct = Math.round((energy / maxEnergy) * 100)

  const statusTitle =
    gameState === 'playing'
      ? 'Ascending'
      : gameState === 'gameover'
        ? 'Energy depleted'
        : 'Ready to rise'

  const statusBody =
    gameState === 'playing'
      ? `Energy ${energyPct}%. Tap a spot to fly there (or WASD). Hold to steer while finger is down. Space dashes in your move direction.`
      : gameState === 'gameover'
        ? `Final score ${score}. Reach ${EPOCH_RISE_REWARD_THRESHOLD} to unlock the Game Faucet claim for this epoch.`
        : `Start at the bottom of the rise. Free 2D flight — up/down/left/right — for orbs and hazards. Claim unlocks at ${EPOCH_RISE_REWARD_THRESHOLD} points.`

  return (
    <GamePageShell
      gameSlug={epochRise.slug}
      title={epochRise.name}
      tagline={epochRise.tagline}
      description={epochRise.longDescription}
      scoreLabel={epochRise.scoreLabel}
      score={score}
      bestScore={bestScore}
      claimScore={claimScore}
      claimEnabled={claimEnabled}
      rewardThreshold={EPOCH_RISE_REWARD_THRESHOLD}
      statusTitle={statusTitle}
      statusBody={statusBody}
      gameStateLabel={gameState}
      compactActions
      gameCanvas={
        <EpochRiseGame
          onScoreChange={handleScoreChange}
          onStateChange={handleStateChange}
          onEnergyChange={handleEnergyChange}
        />
      }
    />
  )
}
