import { useCallback, useEffect, useRef, useState } from 'react'
import { GamePageShell } from '../../components/GamePageShell'
import { useParentCommunication } from '../../hooks/useParentCommunication'
import { getGameDefinition } from '../../utils/games'
import {
  FALCON_FLIGHT_REWARD_THRESHOLD,
  FALCON_FLIGHT_SLUG,
  type FalconFlightGameState,
} from './falconFlightConfig'
import { FalconFlightGame } from './FalconFlightGame'

const falconFlight = getGameDefinition('falcon-flight')

export function FalconFlightPage() {
  const { sendScoreUpdate, claimProgress } = useParentCommunication()
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameState, setGameState] = useState<FalconFlightGameState>('ready')
  const lastSentScore = useRef(-1)

  const handleScoreChange = useCallback(
    (next: number) => {
      setScore(next)
      setBestScore((prev) => Math.max(prev, next))

      // Live score stream to parent portal (dedupe identical values).
      if (next !== lastSentScore.current) {
        lastSentScore.current = next
        sendScoreUpdate(FALCON_FLIGHT_SLUG, next)
      }
    },
    [sendScoreUpdate],
  )

  const handleStateChange = useCallback((state: FalconFlightGameState) => {
    setGameState(state)
  }, [])

  // On unmount / leave, push the last known score once more.
  useEffect(() => {
    return () => {
      if (lastSentScore.current >= 0) {
        sendScoreUpdate(FALCON_FLIGHT_SLUG, lastSentScore.current)
      }
    }
  }, [sendScoreUpdate])

  // Runs add up: claim progress = today's run scores since the last claim.
  const claimScore = claimProgress[FALCON_FLIGHT_SLUG] ?? 0
  const claimEnabled = claimScore >= FALCON_FLIGHT_REWARD_THRESHOLD

  const statusTitle =
    gameState === 'playing'
      ? 'In flight'
      : gameState === 'gameover'
        ? 'Run ended'
        : 'Ready for launch'

  const statusBody =
    gameState === 'playing'
      ? 'Tap a height to fly there (or ↑↓ / W S). Hold to steer while finger is down. Gaps move high and low.'
      : gameState === 'gameover'
        ? `Final score ${score}. It adds to your claim progress (${claimScore} / ${FALCON_FLIGHT_REWARD_THRESHOLD}) — runs add up.`
        : `Horizontal auto-scroller — fly forward, dodge ledger blocks and quantum static. Your runs add up — claim at ${FALCON_FLIGHT_REWARD_THRESHOLD} points in total.`

  return (
    <GamePageShell
      gameSlug={falconFlight.slug}
      title={falconFlight.name}
      tagline={falconFlight.tagline}
      description={falconFlight.longDescription}
      scoreLabel={falconFlight.scoreLabel}
      score={score}
      bestScore={bestScore}
      claimScore={claimScore}
      claimEnabled={claimEnabled}
      rewardThreshold={FALCON_FLIGHT_REWARD_THRESHOLD}
      statusTitle={statusTitle}
      statusBody={statusBody}
      gameStateLabel={gameState}
      compactActions
      gameCanvas={
        <FalconFlightGame
          onScoreChange={handleScoreChange}
          onStateChange={handleStateChange}
        />
      }
    />
  )
}
