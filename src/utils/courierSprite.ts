import Phaser from 'phaser'

/**
 * Ledger Runner avatar — "Clean courier".
 *
 * One clean side-view human runner (facing right): rounded helmet with a gold
 * visor, navy suit with gold chest stripe / belt / shoe flashes, small courier
 * pack, dark-navy outline. Poses are posed procedurally from a tiny skeleton
 * and pre-rendered (6× supersampled) into textures:
 *   8 run-cycle frames · jump (tucked) · slide (low) · land (squash)
 *
 * Coordinates are logical px; origin = standing hitbox centre, feet at y=+20
 * (hitbox is 28×40). Every frame shares that origin, so swapping frames never
 * shifts the body off its hitbox.
 */

export const COURIER = {
  bake: 6,
  boxW: 64,
  boxH: 64,
  /** Origin (hitbox centre) inside the texture box. */
  cx: 30,
  cy: 38,
  /** Feet line below the origin (half of the 40px standing hitbox). */
  footY: 20,
  runFrames: 8,
  colors: {
    outline: 0x060b18,
    suit: 0x2f56a8,
    suitLight: 0x4a74c9,
    suitFar: 0x1f3a75,
    helmet: 0x3a63b8,
    visor: 0xf0c14a,
    visorGlint: 0xfff4cc,
    gold: 0xf0c14a,
    skin: 0xf2c7a0,
    shoe: 0xe2e8f0,
    pack: 0x1b2f5c,
  },
} as const

export const COURIER_RUN_KEYS = Array.from(
  { length: COURIER.runFrames },
  (_, i) => `courier-run-${i}`,
)
export const COURIER_POSE_KEYS = {
  jump: 'courier-jump',
  slide: 'courier-slide',
  land: 'courier-land',
} as const

type V = { x: number; y: number }

type Pose = {
  hip: V
  /** Torso lean from vertical (deg, + = forward). */
  lean: number
  /** Thigh angle from straight-down (deg, + = forward); near / far leg. */
  thighN: number
  thighF: number
  /** Knee bend (deg, shin folds backward). */
  kneeN: number
  kneeF: number
  /** Upper-arm angle from straight-down (+ forward), elbow bend (forearm folds forward). */
  armN: number
  armF: number
  elbowN: number
  elbowF: number
  /** Extra head tilt (deg). */
  head?: number
}

const L = { torso: 16, thigh: 11, shin: 11, upper: 7.5, fore: 7, headR: 6 }
const rad = Phaser.Math.DegToRad

function along(p: V, angDownDeg: number, len: number): V {
  const a = rad(angDownDeg)
  return { x: p.x + Math.sin(a) * len, y: p.y + Math.cos(a) * len }
}

function solve(pose: Pose) {
  const hip = pose.hip
  const neck = { x: hip.x + Math.sin(rad(pose.lean)) * L.torso, y: hip.y - Math.cos(rad(pose.lean)) * L.torso }
  const shoulder = { x: neck.x - Math.sin(rad(pose.lean)) * 2, y: neck.y + Math.cos(rad(pose.lean)) * 2 }
  const leg = (thigh: number, knee: number) => {
    const k = along(hip, thigh, L.thigh)
    const f = along(k, thigh - knee, L.shin)
    return { k, f, footAng: thigh - knee }
  }
  const arm = (up: number, elbow: number) => {
    const e = along(shoulder, up, L.upper)
    const h = along(e, up + elbow, L.fore)
    return { e, h }
  }
  const headC = { x: neck.x + Math.sin(rad(pose.lean)) * 6.5, y: neck.y - Math.cos(rad(pose.lean)) * 6.5 }
  return {
    hip,
    neck,
    shoulder,
    headC,
    legN: leg(pose.thighN, pose.kneeN),
    legF: leg(pose.thighF, pose.kneeF),
    armN: arm(pose.armN, pose.elbowN),
    armF: arm(pose.armF, pose.elbowF),
  }
}

function runPose(i: number): Pose {
  const p = (i / COURIER.runFrames) * Math.PI * 2
  const swing = (ph: number) => 40 * Math.sin(ph)
  const knee = (ph: number) => 14 + 70 * Math.max(0, Math.cos(ph)) ** 1.4
  return {
    hip: { x: 0, y: 0 },
    lean: 14,
    thighN: swing(p),
    thighF: swing(p + Math.PI),
    kneeN: knee(p),
    kneeF: knee(p + Math.PI),
    armN: -42 * Math.sin(p),
    armF: -42 * Math.sin(p + Math.PI),
    elbowN: 80,
    elbowF: 80,
  }
}

const POSES: Record<'jump' | 'slide' | 'land', Pose> = {
  // Tucked jump: knees up, arms forward-up
  jump: { hip: { x: 0, y: -4 }, lean: 18, thighN: 95, thighF: 70, kneeN: 120, kneeF: 105, armN: 120, armF: 70, elbowN: 40, elbowF: 50, head: 0 },
  // Low slide: torso leaning back, legs out front along the floor
  slide: { hip: { x: -2, y: 14 }, lean: -62, thighN: 82, thighF: 72, kneeN: 6, kneeF: 18, armN: -60, armF: 40, elbowN: 30, elbowF: 60, head: 10 },
  // Landing squash: crouched, arms out for balance
  land: { hip: { x: 0, y: 5 }, lean: 24, thighN: 55, thighF: 20, kneeN: 95, kneeF: 70, armN: 50, armF: -30, elbowN: 50, elbowF: 40 },
}

function drawPose(g: Phaser.GameObjects.Graphics, pose: Pose, groundLock: boolean) {
  const C = COURIER
  const c = C.colors
  const k = C.bake
  let s = solve(pose)
  // Run frames: shift so the lowest foot sits exactly on the feet line
  if (groundLock) {
    const low = Math.max(s.legN.f.y, s.legF.f.y) + 1.5
    const dy = C.footY - low
    pose = { ...pose, hip: { x: pose.hip.x, y: pose.hip.y + dy } }
    s = solve(pose)
  }
  const T = (p: V) => ({ x: (p.x + C.cx) * k, y: (p.y + C.cy) * k })
  const ow = 1.6 * k

  const limb = (a: V, b: V, w: number, col: number) => {
    const A = T(a)
    const B = T(b)
    g.lineStyle((w + 2 * 1.6) * k, c.outline, 1)
    g.lineBetween(A.x, A.y, B.x, B.y)
    g.fillStyle(c.outline, 1)
    g.fillCircle(A.x, A.y, (w / 2 + 1.6) * k)
    g.fillCircle(B.x, B.y, (w / 2 + 1.6) * k)
    g.lineStyle(w * k, col, 1)
    g.lineBetween(A.x, A.y, B.x, B.y)
    g.fillStyle(col, 1)
    g.fillCircle(A.x, A.y, (w / 2) * k)
    g.fillCircle(B.x, B.y, (w / 2) * k)
  }
  const shoe = (f: V, ang: number, col: number) => {
    // small rounded shoe pointing forward relative to the shin
    const dir = rad(ang + 90)
    const toe = { x: f.x + Math.sin(dir) * 4.2, y: f.y + Math.cos(dir) * 4.2 }
    limb(f, toe, 3.6, col)
    const a = T(f)
    const b = T(toe)
    g.lineStyle(1.1 * k, c.gold, 1)
    g.lineBetween(a.x + (b.x - a.x) * 0.25, a.y + (b.y - a.y) * 0.25, a.x + (b.x - a.x) * 0.7, a.y + (b.y - a.y) * 0.7)
  }

  // ── far side (darker) ──
  limb(s.shoulder, s.armF.e, 3.8, c.suitFar)
  limb(s.armF.e, s.armF.h, 3.4, c.suitFar)
  limb(s.hip, s.legF.k, 5.2, c.suitFar)
  limb(s.legF.k, s.legF.f, 4.6, c.suitFar)
  shoe(s.legF.f, s.legF.footAng, 0xaab4c4)

  // ── courier pack (on the back) ──
  {
    const lean = rad(pose.lean)
    const back = { x: -Math.cos(lean), y: -Math.sin(lean) }
    const mid = { x: (s.hip.x + s.neck.x) / 2 + back.x * 4.5, y: (s.hip.y + s.neck.y) / 2 + back.y * 4.5 }
    const p0 = { x: mid.x - Math.sin(lean) * 4, y: mid.y + Math.cos(lean) * 4 }
    const p1 = { x: mid.x + Math.sin(lean) * 4, y: mid.y - Math.cos(lean) * 4 }
    limb(p0, p1, 6.5, c.pack)
  }

  // ── torso ──
  limb(s.hip, s.neck, 9, c.suit)
  {
    // gold chest stripe + belt
    const A = T(s.hip)
    const B = T(s.neck)
    const lerp = (t: number) => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t })
    const n = { x: Math.cos(rad(pose.lean)), y: Math.sin(rad(pose.lean)) }
    const s0 = lerp(0.35)
    const s1 = lerp(0.85)
    g.lineStyle(1.4 * k, c.gold, 1)
    g.lineBetween(s0.x + n.x * 2.2 * k, s0.y + n.y * 2.2 * k, s1.x + n.x * 2.2 * k, s1.y + n.y * 2.2 * k)
    const b0 = lerp(0.08)
    g.lineStyle(2 * k, c.gold, 1)
    g.lineBetween(b0.x - n.x * 4 * k, b0.y - n.y * 4 * k, b0.x + n.x * 4 * k, b0.y + n.y * 4 * k)
  }

  // ── near leg ──
  limb(s.hip, s.legN.k, 5.4, c.suit)
  limb(s.legN.k, s.legN.f, 4.8, c.suitLight)
  shoe(s.legN.f, s.legN.footAng, c.shoe)

  // ── helmet + visor ──
  {
    const H = T(s.headC)
    const r = L.headR * k
    g.fillStyle(c.outline, 1)
    g.fillCircle(H.x, H.y, r + ow)
    g.fillStyle(c.helmet, 1)
    g.fillCircle(H.x, H.y, r)
    // face visor (front-facing band)
    const tilt = rad(pose.lean * 0.6 + (pose.head ?? 0))
    const vx = Math.cos(tilt)
    const vy = Math.sin(tilt)
    const cxv = H.x + vx * r * 0.42
    const cyv = H.y + vy * r * 0.42 + 0.4 * k
    g.fillStyle(c.outline, 1)
    g.fillEllipse(cxv, cyv, r * 1.25, r * 0.95)
    g.fillStyle(c.visor, 1)
    g.fillEllipse(cxv + vx * 0.3 * k, cyv, r * 1.0, r * 0.66)
    g.fillStyle(c.visorGlint, 1)
    g.fillEllipse(cxv + vx * r * 0.22, cyv - r * 0.12, r * 0.32, r * 0.18)
    // helmet crest stripe
    g.lineStyle(1.2 * k, c.suitLight, 1)
    g.beginPath()
    g.arc(H.x, H.y, r * 0.72, rad(200), rad(290), false)
    g.strokePath()
  }

  // ── near arm ──
  limb(s.shoulder, s.armN.e, 4, c.suit)
  limb(s.armN.e, s.armN.h, 3.6, c.suitLight)
  {
    const h = T(s.armN.h)
    g.fillStyle(c.gold, 1)
    g.fillCircle(h.x, h.y, 1.7 * k)
  }
}

export function ensureCourierTextures(scene: Phaser.Scene) {
  const C = COURIER
  const bake = (key: string, pose: Pose, lock: boolean) => {
    if (scene.textures.exists(key)) return
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    drawPose(g, pose, lock)
    g.generateTexture(key, C.boxW * C.bake, C.boxH * C.bake)
    g.destroy()
  }
  COURIER_RUN_KEYS.forEach((key, i) => bake(key, runPose(i), true))
  bake(COURIER_POSE_KEYS.jump, POSES.jump, false)
  bake(COURIER_POSE_KEYS.slide, POSES.slide, true)
  bake(COURIER_POSE_KEYS.land, POSES.land, true)
}

export type Courier = {
  root: Phaser.GameObjects.Container
  image: Phaser.GameObjects.Image
  clock: number
  key: string
  landUntil: number
  wasAirborne: boolean
}

/** Visual-only upsize on portrait / phone canvases (hitbox never changes). */
export const COURIER_MOBILE_VISUAL_SCALE = 1.2

export function courierMobileScale(scene: Phaser.Scene): number {
  const { width, height } = scene.scale
  return height > width ? COURIER_MOBILE_VISUAL_SCALE : 1
}

export function createCourier(scene: Phaser.Scene, x: number, y: number, depth = 11): Courier {
  ensureCourierTextures(scene)
  const C = COURIER
  const image = scene.add.image(0, 0, COURIER_RUN_KEYS[0])
  image.setOrigin(C.cx / C.boxW, C.cy / C.boxH)
  image.setScale(1 / C.bake)
  const root = scene.add.container(x, y, [image]).setDepth(depth)
  return { root, image, clock: 0, key: COURIER_RUN_KEYS[0], landUntil: 0, wasAirborne: false }
}

export type CourierState = {
  now: number
  playing: boolean
  dead: boolean
  onGround: boolean
  sliding: boolean
  /** scrollSpeed / baseScrollSpeed — drives the run-cycle frame rate. */
  speedFactor: number
}

/** Per-frame: choose run / jump / slide / land frame. Frame rate follows game speed. */
export function animateCourier(c: Courier, deltaMs: number, st: CourierState) {
  if (st.dead) return
  const dt = Math.min(deltaMs, 100)
  let key: string
  if (st.playing && !st.onGround && !st.sliding) {
    c.wasAirborne = true
    key = COURIER_POSE_KEYS.jump
  } else {
    if (c.wasAirborne && st.playing) c.landUntil = st.now + 90
    c.wasAirborne = false
    if (st.sliding) key = COURIER_POSE_KEYS.slide
    else if (st.now < c.landUntil) key = COURIER_POSE_KEYS.land
    else {
      const fps = st.playing ? Phaser.Math.Clamp(13 * st.speedFactor, 9, 24) : 6
      c.clock += (dt / 1000) * fps
      key = COURIER_RUN_KEYS[Math.floor(c.clock) % COURIER_RUN_KEYS.length]
    }
  }
  if (key !== c.key) {
    c.key = key
    c.image.setTexture(key)
  }
}
