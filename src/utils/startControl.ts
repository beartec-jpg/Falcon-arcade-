import type Phaser from 'phaser'

/**
 * Unified start / restart plumbing shared by all four games.
 *
 * Mobile browsers (iOS Safari especially, and inside the falcon-fpl.com
 * iframe) are unreliable about taps on canvas-drawn "TAP TO START" text: the
 * CTA can sit below the fold, a how-to panel can swallow taps outside its box,
 * and keyboard (SPACE) needs focus the iframe never gets. So every scene:
 *  - exposes `requestStart()` (how-to → ready → playing, gameover → restart),
 *  - starts on a canvas `pointerdown` anywhere while not playing,
 *  - reports its phase so React can render a real <button> over the canvas.
 */
export type GamePhase = 'howto' | 'ready' | 'playing' | 'gameover'

export const START_REQUEST_EVENT = 'falcon:start-request'
export const PHASE_EVENT = 'falcon:phase'

/** Last phase per game, so a late React subscriber still gets the current one. */
const PHASE_KEY = 'falcon:phase'

export function emitPhase(scene: Phaser.Scene, phase: GamePhase) {
  scene.game.registry.set(PHASE_KEY, phase)
  scene.game.events.emit(PHASE_EVENT, phase)
}

export function currentPhase(game: Phaser.Game): GamePhase | null {
  return (game.registry.get(PHASE_KEY) as GamePhase | undefined) ?? null
}

/** Route DOM start-button presses to the scene; unbinds on scene shutdown. */
export function bindStartRequests(scene: Phaser.Scene, onStart: () => void) {
  scene.game.events.on(START_REQUEST_EVENT, onStart)
  scene.events.once('shutdown', () => {
    scene.game.events.off(START_REQUEST_EVENT, onStart)
  })
  scene.events.once('destroy', () => {
    scene.game.events.off(START_REQUEST_EVENT, onStart)
  })
}

export function requestGameStart(game: Phaser.Game | null | undefined) {
  game?.events.emit(START_REQUEST_EVENT)
}
