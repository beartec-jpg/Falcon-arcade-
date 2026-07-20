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
  const { sendScoreUpdate } = useParentCommunication()
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

  const claimScore = Math.max(score, bestScore)
  const claimEnabled = claimScore >= AMENDMENT_REWARD_THRESHOLD

  const statusTitle =
    gameState === 'playing'
      ? `Defending · Tier ${tier}/6`
      : gameState === 'gameover'
        ? 'Consensus broken'
        : 'Ready to deploy'

  const statusBody =
    gameState === 'playing'
      ? 'WASD or drag to fly. Weapons auto-fire. Grab green+ upgrade scrolls. Two hits without an upgrade ends the run.'
      : gameState === 'gameover'
        ? `Final score ${score}. Reach ${AMENDMENT_REWARD_THRESHOLD} to unlock the Game Faucet claim.`
        : `Shoot mode — free-roam arena, auto-fire, green+ upgrades and Hard Forks. Claim at ${AMENDMENT_REWARD_THRESHOLD}.`

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
