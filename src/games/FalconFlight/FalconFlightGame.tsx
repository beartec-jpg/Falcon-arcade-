import { useEffect, useRef } from 'react'
import { usePhaserGame } from '../../hooks/usePhaserGame'
import {
  FALCON_COLORS,
  FALCON_FLIGHT,
  type FalconFlightBridge,
  type FalconFlightGameState,
} from './falconFlightConfig'
import { FalconFlightScene } from './FalconFlightScene'

type FalconFlightGameProps = {
  onScoreChange: (score: number) => void
  onStateChange: (state: FalconFlightGameState) => void
}

export function FalconFlightGame({
  onScoreChange,
  onStateChange,
}: FalconFlightGameProps) {
  const bridgeRef = useRef<FalconFlightBridge>({
    onScoreChange,
    onStateChange,
  })

  useEffect(() => {
    bridgeRef.current = { onScoreChange, onStateChange }
  }, [onScoreChange, onStateChange])

  const containerRef = usePhaserGame(FalconFlightScene, {
    width: FALCON_FLIGHT.width,
    height: FALCON_FLIGHT.height,
    backgroundColor: FALCON_COLORS.bgHex,
    arcadePhysics: true,
    onGameCreated: (game) => {
      const bridge: FalconFlightBridge = {
        onScoreChange: (score) => bridgeRef.current.onScoreChange(score),
        onStateChange: (state) => bridgeRef.current.onStateChange(state),
      }
      game.registry.set('falconFlightBridge', bridge)
    },
  })

  return (
    <div
      ref={containerRef}
      className="phaser-game-host"
      role="application"
      aria-label="Falcon Flight game canvas"
    />
  )
}
