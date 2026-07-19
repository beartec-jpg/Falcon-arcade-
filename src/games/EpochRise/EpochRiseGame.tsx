import { useEffect, useRef } from 'react'
import { usePhaserGame } from '../../hooks/usePhaserGame'
import {
  EPOCH_COLORS,
  EPOCH_RISE,
  type EpochRiseBridge,
  type EpochRiseGameState,
} from './epochRiseConfig'
import { EpochRiseScene } from './EpochRiseScene'

type EpochRiseGameProps = {
  onScoreChange: (score: number) => void
  onStateChange: (state: EpochRiseGameState) => void
  onEnergyChange?: (energy: number, max: number) => void
}

export function EpochRiseGame({
  onScoreChange,
  onStateChange,
  onEnergyChange,
}: EpochRiseGameProps) {
  const bridgeRef = useRef<EpochRiseBridge>({
    onScoreChange,
    onStateChange,
    onEnergyChange,
  })

  useEffect(() => {
    bridgeRef.current = { onScoreChange, onStateChange, onEnergyChange }
  }, [onScoreChange, onStateChange, onEnergyChange])

  const containerRef = usePhaserGame(EpochRiseScene, {
    width: EPOCH_RISE.width,
    height: EPOCH_RISE.height,
    backgroundColor: EPOCH_COLORS.bgHex,
    arcadePhysics: true,
    onGameCreated: (game) => {
      const bridge: EpochRiseBridge = {
        onScoreChange: (score) => bridgeRef.current.onScoreChange(score),
        onStateChange: (state) => bridgeRef.current.onStateChange(state),
        onEnergyChange: (energy, max) =>
          bridgeRef.current.onEnergyChange?.(energy, max),
      }
      game.registry.set('epochRiseBridge', bridge)
    },
  })

  return (
    <div
      ref={containerRef}
      className="phaser-game-host"
      role="application"
      aria-label="Epoch Rise game canvas"
    />
  )
}
