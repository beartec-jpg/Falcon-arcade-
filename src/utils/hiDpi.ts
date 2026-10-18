import Phaser from 'phaser'

/**
 * DPR-correct rendering for Phaser 3.90 (no `resolution` config any more).
 *
 * The game canvas is created at `logical × renderScale` pixels and every scene
 * zooms its main camera by `renderScale` (origin top-left). Scenes keep working
 * in the original logical units: `this.scale.width/height` is replaced by a
 * thin proxy that reports logical size, and pointer `worldX/worldY` is already
 * logical through the camera. Vector shapes, graphics and text render crisp
 * at device resolution instead of being bilinear-upscaled by CSS.
 */

const REGISTRY_KEY = 'renderScale'
export const MAX_RENDER_SCALE = 2

export function computeRenderScale(): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return Phaser.Math.Clamp(dpr, 1, MAX_RENDER_SCALE)
}

export function getRenderScale(scene: Phaser.Scene | Phaser.Game): number {
  const game = scene instanceof Phaser.Game ? scene : scene.game
  return (game.registry.get(REGISTRY_KEY) as number | undefined) ?? 1
}

export function setRenderScale(game: Phaser.Game, r: number) {
  game.registry.set(REGISTRY_KEY, r)
}

let textPatched = false
/** Render every Text object at the device render scale (call once). */
export function patchTextResolution() {
  if (textPatched) return
  textPatched = true
  const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (...args: unknown[]) => Phaser.GameObjects.Text
  }
  const original = proto.text
  proto.text = function (this: Phaser.GameObjects.GameObjectFactory, ...args: unknown[]) {
    const t = original.apply(this, args)
    const r = getRenderScale(this.scene)
    if (r > 1) t.setResolution(r)
    return t
  }
}

/**
 * Call first thing in a scene's `create()`. Safe to call when renderScale is 1.
 */
export function applyHiDpi(scene: Phaser.Scene) {
  const r = getRenderScale(scene)
  const real = scene.sys.scale
  if (r > 1) {
    const proxy = new Proxy(real, {
      get(target, key) {
        if (key === 'width') return target.width / r
        if (key === 'height') return target.height / r
        const v = Reflect.get(target, key, target) as unknown
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v
      },
    })
    ;(scene as unknown as { scale: Phaser.Scale.ScaleManager }).scale = proxy
    const cam = scene.cameras.main
    cam.setOrigin(0, 0)
    cam.setZoom(r)
  }
  const { width, height } = scene.scale
  scene.physics?.world?.setBounds(0, 0, width, height)
}

/** CSS pixels per logical pixel for the current canvas fit. */
export function cssPerLogical(scene: Phaser.Scene): number {
  const { width, height } = scene.scale
  const host = scene.game.canvas?.parentElement
  const pw = host?.clientWidth || scene.game.canvas?.clientWidth || width
  const ph = host?.clientHeight || scene.game.canvas?.clientHeight || height
  return Math.min(pw / width, ph / height) || 1
}

/**
 * Logical font size that renders at least `css` CSS px on screen
 * (never smaller than `minLogical`).
 */
export function cssFont(scene: Phaser.Scene, css: number, minLogical = 0): string {
  const ratio = cssPerLogical(scene)
  return `${Math.max(minLogical, Math.ceil(css / Math.min(1, ratio)))}px`
}
