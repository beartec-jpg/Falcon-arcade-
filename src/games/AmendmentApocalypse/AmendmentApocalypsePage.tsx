import { useCallback, useEffect, useRef, useState } from 'react'
import { GamePageShell } from '../../components/GamePageShell'
import { useParentCommunication } from '../../hooks/useParentCommunication'
import { getGameDefinition } from '../../utils/games'
import {
  AMENDMENT_REWARD_THRESHOLD,
  AMENDMENT_SLUG,
  type AmendmentGameState,
} from './amendmentApocalypseConfig'
import { AmendmentApocalypseGame } from './AmendmentApocalypseGame'

const game = getGameDefinition('amendment-apocalypse')

export function AmendmentApocalypsePage() {
  const { sendScoreUpdate, claimProgress } = useParentCommunication()
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [tier, setTier] = useState(1)
  const [gameState, setGameState] = useState<AmendmentGameState>('ready')
  const lastSentScore = useRef(-1)

  const handleScoreChange = useCallback(
    (next: number) => {
      setScore(next)
      setBestScore((prev) => Math.max(prev, next))
      if (next !== lastSentScore.current) {
        lastSentScore.current = next
        sendScoreUpdate(AMENDMENT_SLUG, next)
      }
    },
    [sendScoreUpdate],
  )

  const handleStateChange = useCallback((state: AmendmentGameState) => {
    setGameState(state)
  }, [])

  const handleTierChange = useCallback((next: number) => {
    setTier(next)
  }, [])

  useEffect(() => {
    return () => {
      if (lastSentScore.current >= 0) {
        sendScoreUpdate(AMENDMENT_SLUG, lastSentScore.current)
      }
    }
  }, [sendScoreUpdate])

  // Runs add up: claim progress = today's run scores since the last claim.
  const claimScore = claimProgress[AMENDMENT_SLUG] ?? 0
  const claimEnabled = claimScore >= AMENDMENT_REWARD_THRESHOLD

  const statusTitle =
    gameState === 'playing'
      ? `Defending · Tier ${tier}/6`
      : gameState === 'gameover'
        ? 'Consensus broken'
        : 'Ready to deploy'

  const statusBody =
    gameState === 'playing'
      ? 'Tap a spot to fly there (or WASD). Hold to steer while finger is down. Weapons auto-fire. Grab green+ upgrade scrolls.'
      : gameState === 'gameover'
        ? `Final score ${score}. It adds to your claim progress (${claimScore} / ${AMENDMENT_REWARD_THRESHOLD}) — runs add up.`
        : `Shoot mode — free-roam arena, auto-fire, green+ upgrades and Hard Forks. Runs add up — claim at ${AMENDMENT_REWARD_THRESHOLD} total.`

  return (
    <GamePageShell
      gameSlug={game.slug}
      title={game.name}
      tagline={game.tagline}
      description={game.longDescription}
      scoreLabel={game.scoreLabel}
      score={score}
      bestScore={bestScore}
      claimScore={claimScore}
      claimEnabled={claimEnabled}
      rewardThreshold={AMENDMENT_REWARD_THRESHOLD}
      statusTitle={statusTitle}
      statusBody={statusBody}
      gameStateLabel={gameState}
      compactActions
      gameCanvas={
        <AmendmentApocalypseGame
          onScoreChange={handleScoreChange}
          onStateChange={handleStateChange}
          onTierChange={handleTierChange}
        />
      }
    />
  )
}
