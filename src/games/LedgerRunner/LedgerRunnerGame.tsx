import { usePhaserGame } from '../../hooks/usePhaserGame'
import { LedgerRunnerScene } from './LedgerRunnerScene'

export function LedgerRunnerGame() {
  const containerRef = usePhaserGame(LedgerRunnerScene)

  return <div ref={containerRef} className="phaser-shell__frame" />
}
