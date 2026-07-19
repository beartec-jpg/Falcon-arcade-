import { useEffect, useRef } from 'react'
import { usePhaserGame } from '../../hooks/usePhaserGame'
import {
  LEDGER_RUNNER,
  RUNNER_COLORS,
  type LedgerRunnerBridge,
  type LedgerRunnerGameState,
} from './ledgerRunnerConfig'
import { LedgerRunnerScene } from './LedgerRunnerScene'

type LedgerRunnerGameProps = {
  onScoreChange: (score: number) => void
  onStateChange: (state: LedgerRunnerGameState) => void
}

export function LedgerRunnerGame({
  onScoreChange,
  onStateChange,
}: LedgerRunnerGameProps) {
  const bridgeRef = useRef<LedgerRunnerBridge>({
    onScoreChange,
    onStateChange,
  })

  useEffect(() => {
    bridgeRef.current = { onScoreChange, onStateChange }
  }, [onScoreChange, onStateChange])

  const containerRef = usePhaserGame(LedgerRunnerScene, {
    width: LEDGER_RUNNER.width,
    height: LEDGER_RUNNER.height,
    backgroundColor: RUNNER_COLORS.bgHex,
    arcadePhysics: true,
    onGameCreated: (game) => {
      const bridge: LedgerRunnerBridge = {
        onScoreChange: (score) => bridgeRef.current.onScoreChange(score),
        onStateChange: (state) => bridgeRef.current.onStateChange(state),
      }
      game.registry.set('ledgerRunnerBridge', bridge)
    },
  })

  return (
    <div
      ref={containerRef}
      className="phaser-game-host"
      role="application"
      aria-label="Ledger Runner game canvas"
    />
  )
}
