import { usePhaserGame } from '../../hooks/usePhaserGame'
import { FalconFlightScene } from './FalconFlightScene'

export function FalconFlightGame() {
  const containerRef = usePhaserGame(FalconFlightScene)

  return <div ref={containerRef} className="phaser-shell__frame" />
}
