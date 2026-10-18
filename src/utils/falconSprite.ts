import Phaser from 'phaser'

/**
 * Falcon Flight player: one clean side-view falcon silhouette (facing right).
 *
 * Head with hooked beak + dark malar "moustache" stripe, cream body, swept
 * gold wing, fanned gold tail, 2px dark-navy outline. Three baked wing frames
 * (up / mid / down) drawn as vector paths at high resolution and shown as a
 * single Image, so there is nothing to jitter between frames.
 */

export const FALCON_SPRITE = {
  /** Supersampling for the baked frames (logical px → texture px). */
  bake: 6,
  /** Display scale of the art (1 = 46px long). Body ≈ hitbox (r 11). */
  displayScale: 1.2,
  /** Texture box in logical px (falcon spans roughly x −25…20, y −23…17). */
  boxW: 52,
  boxH: 46,
  /** Logical centre inside the box (= body centre = hitbox centre). */
  cx: 27,
  cy: 24,
  /** Max visual tilt in degrees. */
  maxTilt: 18,
  /** Tilt smoothing time constant (ms) — time-based, frame-rate independent. */
  tiltTau: 90,
  colors: {
    outline: 0x0b1224,
    body: 0xfef3c7,
    bodyShade: 0xf2d9a0,
    wing: 0xd4922a,
    wingLight: 0xf0c14a,
    wingDark: 0xa06a20,
    tail: 0xc98a2a,
    cap: 0x8a5a1a,
    beak: 0xe8a838,
    beakTip: 0x5c3a10,
    eye: 0x0b1224,
  },
} as const

export const FALCON_FRAME_KEYS = ['falcon-wing-up', 'falcon-wing-mid', 'falcon-wing-down'] as const

type P = [number, number]

function bezierPoints(start: P, segs: [P, P, P][], steps = 10): Phaser.Math.Vector2[] {
  const path = new Phaser.Curves.Path(start[0], start[1])
  for (const [c1, c2, end] of segs) {
    path.cubicBezierTo(end[0], end[1], c1[0], c1[1], c2[0], c2[1])
  }
  return path.getPoints(steps)
}

const WINGS: Record<0 | 1 | 2, P[]> = {
  // Upstroke: wing raised and swept back above the back
  0: [[4, -3], [0, -11], [-5, -19], [-9, -23], [-12, -21], [-11, -16], [-12, -12], [-9, -5], [-6, -2]],
  // Mid: wing stretched back, slightly raised (glide)
  1: [[4, -3], [-3, -8], [-11, -11], [-20, -13], [-21, -10], [-17, -8], [-15, -5], [-8, -1]],
  // Downstroke: wing swept down below the belly
  2: [[4, -2], [0, 5], [-4, 11], [-8, 17], [-12, 15], [-11, 10], [-12, 6], [-9, 1], [-6, -1]],
}

/** Primary-feather separation lines per frame (from → to). */
const PRIMARIES: Record<0 | 1 | 2, [P, P][]> = {
  0: [[[-7, -13], [-11, -19]], [[-8, -9], [-11.5, -14]]],
  1: [[[-12, -8], [-19, -11]], [[-10, -5], [-16, -7]]],
  2: [[[-7, 8], [-10, 14]], [[-8, 4], [-11, 9]]],
}

function drawFalconFrame(g: Phaser.GameObjects.Graphics, frame: 0 | 1 | 2) {
  const S = FALCON_SPRITE
  const k = S.bake
  const c = S.colors
  const T = (p: P): P => [(p[0] + S.cx) * k, (p[1] + S.cy) * k]
  const poly = (pts: (P | Phaser.Math.Vector2)[]) =>
    pts.map((p) => (Array.isArray(p) ? T(p) : T([p.x, p.y]))).map(([x, y]) => ({ x, y }))
  const outlineW = 1.8 * k

  const fillOutline = (pts: { x: number; y: number }[], fill: number) => {
    g.fillStyle(fill, 1)
    g.fillPoints(pts, true)
    g.lineStyle(outlineW, c.outline, 1)
    g.strokePoints(pts, true, true)
  }

  // ── Tail fan (behind body) ──
  const tail: P[] = [[-9, -2], [-20, -7], [-23, -5], [-25, -1.5], [-25, 2], [-23, 5], [-20, 6.5], [-9, 3]]
  fillOutline(poly(tail), c.tail)
  g.lineStyle(0.9 * k, c.wingDark, 0.9)
  for (const y of [-3.5, 0.2, 3.6]) {
    const a = T([-12, y * 0.4])
    const b = T([-23, y])
    g.lineBetween(a[0], a[1], b[0], b[1])
  }

  // ── Body (teardrop: chest at right, tapering to tail) ──
  const body = bezierPoints([-11, 1], [
    [[-8, -5], [2, -7.5], [9, -6]],
    [[13, -5], [14, 2], [10, 4.5]],
    [[5, 7], [-5, 6], [-11, 1]],
  ])
  fillOutline(poly(body), c.body)
  // belly shading
  const belly = bezierPoints([-8, 3], [[[ -2, 6.2], [5, 6.4], [9, 4]], [[4, 4.5], [-2, 4.2], [-8, 3]]])
  g.fillStyle(c.bodyShade, 1)
  g.fillPoints(poly(belly), true)

  // ── Hooked beak ──
  const beak = bezierPoints([12.5, -6.6], [
    [[16.5, -7], [20, -5.2], [20, -2.6]],
    [[20, -1.2], [19.2, -0.4], [18.4, -0.2]],
    [[18.6, -1.4], [16.5, -2.4], [12.5, -2.2]],
  ])
  fillOutline(poly(beak), c.beak)
  const tip = bezierPoints([19.2, -3.4], [[[20.1, -2.6], [19.7, -0.8], [18.4, -0.2]], [[18.7, -1.3], [18.8, -2.3], [19.2, -3.4]]])
  g.fillStyle(c.beakTip, 1)
  g.fillPoints(poly(tip), true)

  // ── Head ──
  const head = bezierPoints([6, -5], [
    [[7, -10], [14, -10.5], [15.5, -6]],
    [[16.5, -3], [15, 0], [11.5, 0.5]],
    [[9, 0.8], [6.5, -1], [6, -5]],
  ])
  fillOutline(poly(head), c.body)
  // dark cap (crown + nape)
  const cap = bezierPoints([6.4, -5.5], [
    [[7.2, -9.8], [13.6, -10.4], [15.3, -6.6]],
    [[12.5, -7.4], [9.5, -7], [6.4, -5.5]],
  ])
  g.fillStyle(c.cap, 1)
  g.fillPoints(poly(cap), true)
  // malar stripe ("moustache") — the classic falcon face mark
  const malar = bezierPoints([11.2, -4.6], [[[12.6, -3.6], [12.2, -0.6], [11, 0.4]], [[10.2, -0.9], [10.4, -3.4], [11.2, -4.6]]])
  g.fillStyle(c.outline, 0.92)
  g.fillPoints(poly(malar), true)

  // ── Eye (with gold ring + glint) ──
  const e = T([13.2, -5.4])
  g.fillStyle(c.wingLight, 1)
  g.fillCircle(e[0], e[1], 1.9 * k)
  g.fillStyle(c.eye, 1)
  g.fillCircle(e[0], e[1], 1.35 * k)
  g.fillStyle(0xffffff, 1)
  g.fillCircle(e[0] + 0.45 * k, e[1] - 0.45 * k, 0.45 * k)

  // ── Wing (near side, in front of body) ──
  const wing = poly(WINGS[frame])
  fillOutline(wing, c.wing)
  // leading-edge highlight
  const w = WINGS[frame]
  g.lineStyle(1.1 * k, c.wingLight, 0.95)
  const a0 = T(w[0])
  const a1 = T(w[1])
  const a2 = T(w[2])
  g.lineBetween(a0[0], a0[1], a1[0], a1[1])
  g.lineBetween(a1[0], a1[1], a2[0], a2[1])
  g.lineStyle(0.9 * k, c.wingDark, 0.95)
  for (const [from, to] of PRIMARIES[frame]) {
    const f = T(from)
    const t = T(to)
    g.lineBetween(f[0], f[1], t[0], t[1])
  }
}

export function ensureFalconTextures(scene: Phaser.Scene) {
  const S = FALCON_SPRITE
  FALCON_FRAME_KEYS.forEach((key, i) => {
    if (scene.textures.exists(key)) return
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    drawFalconFrame(g, i as 0 | 1 | 2)
    g.generateTexture(key, S.boxW * S.bake, S.boxH * S.bake)
    g.destroy()
  })
}

export type FalconSprite = {
  root: Phaser.GameObjects.Container
  image: Phaser.GameObjects.Image
  flapClock: number
  frame: number
}

export type FalconSpriteOptions = {
  /** Visual size multiplier on top of FALCON_SPRITE.displayScale (hitbox untouched). */
  scale?: number
  /**
   * Fixed art rotation in degrees, applied to the inner image so the
   * container angle stays a pure tilt (e.g. -90 = falcon faces up for Rise).
   */
  baseAngle?: number
}

/** Visual-only upsize on portrait / phone canvases (hitboxes never change). */
export const FALCON_MOBILE_VISUAL_SCALE = 1.2

export function falconMobileScale(scene: Phaser.Scene): number {
  const { width, height } = scene.scale
  return height > width ? FALCON_MOBILE_VISUAL_SCALE : 1
}

export function createFalconSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 11,
  opts: FalconSpriteOptions = {},
): FalconSprite {
  ensureFalconTextures(scene)
  const S = FALCON_SPRITE
  const image = scene.add.image(0, 0, FALCON_FRAME_KEYS[1])
  // Body centre of the art sits on the container origin (= hitbox centre)
  image.setOrigin(S.cx / S.boxW, S.cy / S.boxH)
  image.setScale((S.displayScale * (opts.scale ?? 1)) / S.bake)
  image.setAngle(opts.baseAngle ?? 0)
  const root = scene.add.container(x, y, [image]).setDepth(depth)
  return { root, image, flapClock: 0, frame: 1 }
}

/** Wing cycle: up → mid → down → mid. */
const FLAP_SEQUENCE = [0, 1, 2, 1] as const

export type FalconMood = 'idle' | 'play' | 'boost' | 'dead'

/**
 * Per-frame update. `vy` / `maxVy` drive the tilt (Rise passes horizontal
 * velocity here so the up-facing bird banks into its sideways motion); tilt is clamped to
 * ±maxTilt and eased with a time-based exponential (no per-frame lerp).
 * In 'dead' mode the angle is left alone (scene runs a death tween).
 */
export function animateFalconSprite(
  f: FalconSprite,
  deltaMs: number,
  mood: FalconMood,
  vy = 0,
  maxVy = 1,
  flapRate = 1,
  opts: { allowTuck?: boolean } = {},
) {
  const S = FALCON_SPRITE
  const dt = Math.min(deltaMs, 100)
  if (mood !== 'dead') {
    // Flap: ~9 wingbeats/sec cycle-steps in play, slower idle; tuck in a hard dive
    const diving = (opts.allowTuck ?? true) && mood !== 'idle' && vy > maxVy * 0.6
    const stepsPerSec = mood === 'idle' ? 6 : diving ? 5 : 10 * flapRate
    f.flapClock += (dt / 1000) * stepsPerSec
    const step = Math.floor(f.flapClock) % FLAP_SEQUENCE.length
    const frame = FLAP_SEQUENCE[step]
    if (frame !== f.frame) {
      f.frame = frame
      f.image.setTexture(FALCON_FRAME_KEYS[frame])
    }
    const target =
      mood === 'idle'
        ? 0
        : Phaser.Math.Clamp((vy / Math.max(1, maxVy)) * S.maxTilt, -S.maxTilt, S.maxTilt)
    const k = 1 - Math.exp(-dt / S.tiltTau)
    const next = f.root.angle + (target - f.root.angle) * k
    f.root.angle = Phaser.Math.Clamp(next, -S.maxTilt, S.maxTilt)
  }
}
