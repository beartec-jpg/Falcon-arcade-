import { usePhaserGame } from '../../hooks/usePhaserGame'
import { EpochRiseScene } from './EpochRiseScene'

export function EpochRiseGame() {
  const containerRef = usePhaserGame(EpochRiseScene)

  return <div ref={containerRef} className="phaser-shell__frame" />
}
