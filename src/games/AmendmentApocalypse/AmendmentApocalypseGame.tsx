import { useEffect, useRef } from 'react'
import { usePhaserGame } from '../../hooks/usePhaserGame'
import {
  AA,
  AA_COLORS,
  type AmendmentBridge,
  type AmendmentGameState,
} from './amendmentApocalypseConfig'
import { AmendmentApocalypseScene } from './AmendmentApocalypseScene'

type Props = {
  onScoreChange: (score: number) => void
  onStateChange: (state: AmendmentGameState) => void
  onTierChange?: (tier: number) => void
}

export function AmendmentApocalypseGame({
  onScoreChange,
  onStateChange,
  onTierChange,
}: Props) {
  const bridgeRef = useRef<AmendmentBridge>({
    onScoreChange,
    onStateChange,
    onTierChange,
  })

  useEffect(() => {
    bridgeRef.current = { onScoreChange, onStateChange, onTierChange }
  }, [onScoreChange, onStateChange, onTierChange])

  const containerRef = usePhaserGame(AmendmentApocalypseScene, {
    width: AA.width,
    height: AA.height,
    backgroundColor: AA_COLORS.bgHex,
    arcadePhysics: true,
    onGameCreated: (game) => {
      const bridge: AmendmentBridge = {
        onScoreChange: (score) => bridgeRef.current.onScoreChange(score),
        onStateChange: (state) => bridgeRef.current.onStateChange(state),
        onTierChange: (tier) => bridgeRef.current.onTierChange?.(tier),
      }
      game.registry.set('amendmentBridge', bridge)
    },
  })

  return (
    <div
      ref={containerRef}
      className="phaser-game-host"
      role="application"
      aria-label="Amendment Apocalypse game canvas"
    />
  )
}
