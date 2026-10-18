import type { GamePhase } from '../utils/startControl'

type Props = {
  phase: GamePhase | null
  onStart: () => void
  startLabel?: string
  restartLabel?: string
}

/**
 * Real DOM <button> over the canvas for start / restart.
 *
 * Buttons are natively interactive, so iOS Safari fires the activation
 * reliably (canvas-drawn text is not), they need no keyboard focus inside the
 * portal iframe, and they sit near the top of the playfield so they stay on
 * screen even when the canvas runs past the fold.
 */
export function GameStartButton({
  phase,
  onStart,
  startLabel = 'Tap to start',
  restartLabel = 'Restart',
}: Props) {
  if (phase !== 'howto' && phase !== 'ready' && phase !== 'gameover') {
    return null
  }
  const label = phase === 'gameover' ? restartLabel : startLabel
  return (
    <button
      type="button"
      className="game-start-button"
      data-phase={phase}
      data-testid="game-start-button"
      // pointerdown starts at once (no 300 ms delay / ghost click); click
      // covers keyboard + assistive tech. requestStart is idempotent per phase.
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onStart()
      }}
      onClick={(event) => {
        event.stopPropagation()
        onStart()
      }}
    >
      {label}
    </button>
  )
}
