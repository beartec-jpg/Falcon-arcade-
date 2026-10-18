import Phaser from 'phaser'

/**
 * Amendment Apocalypse player ship — one clean top-down falcon fighter
 * (nose = +X), navy hull, gold canopy/edges, dark navy outline. Same family
 * as the Flight/Rise falcon and the Run courier.
 *
 * Pre-baked textures: 6 weapon tiers × 3 bank poses (wing pods grow per tier)
 * plus 3 thruster-flicker frames. Shown at scale 1/bake.
 */
export const SHIP = {
  bake: 5,
  box: 64,
  outline: 0x060b18,
  hull: 0x2f56a8,
  hullLight: 0x4a74c9,
  hullDark: 0x1f3a75,
  gold: 0xf0c14a,
  goldDeep: 0xc9952e,
  pod: 0x24427f,
  core: 0x67e8f9,
} as const

/** Visual-only size of the fighter vs its 64px texture box (hitbox is separate). */
export const SHIP_VISUAL_SCALE = 1.35

export type ShipBank = -1 | 0 | 1
const BANKS: ShipBank[] = [-1, 0, 1]

export const shipKey = (tier: number, bank: ShipBank) =>
  `aa-ship-t${tier}-${bank < 0 ? 'l' : bank > 0 ? 'r' : 'c'}`
export const SHIP_FLAME_KEYS = ['aa-flame-0', 'aa-flame-1', 'aa-flame-2'] as const

type Pt = [number, number]
type Shape = { pts: Pt[]; fill: number }

/** Mirror points across the ship's long axis. */
const mir = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x, -y])

function shapesFor(tier: number, bank: ShipBank): Shape[] {
  // Banking: the wing on the inside of the turn foreshortens + darkens,
  // the outer wing reaches and catches light. bank -1 = turning toward -Y.
  const spanT = bank < 0 ? 0.78 : bank > 0 ? 1.08 : 1
  const spanB = bank > 0 ? 0.78 : bank < 0 ? 1.08 : 1
  const wing = (span: number): Pt[] => [
    [5, -3.5],
    [-3, -10 * span],
    [-9, -19 * span],
    [-13, -18.5 * span],
    [-11, -11 * span],
    [-9, -4],
  ]
  const wT = wing(spanT)
  const wB = mir(wing(spanB))
  const shapes: Shape[] = []
  // Tail fan (falcon tail feathers)
  shapes.push({
    pts: [[-10, -4], [-19, -8], [-17, -3], [-20, 0], [-17, 3], [-19, 8], [-10, 4]],
    fill: SHIP.hullDark,
  })
  shapes.push({ pts: wT, fill: bank < 0 ? SHIP.hullDark : bank > 0 ? SHIP.hullLight : SHIP.hull })
  shapes.push({ pts: wB, fill: bank > 0 ? SHIP.hullDark : bank < 0 ? SHIP.hullLight : SHIP.hull })
  // Fuselage
  shapes.push({
    pts: [[21, 0], [12, -3.6], [2, -5], [-11, -4.2], [-13, 0], [-11, 4.2], [2, 5], [12, 3.6]],
    fill: SHIP.hull,
  })
  void tier
  return shapes
}

type Pod = { x: number; y: number; len: number }
/** Wing pods by tier — tier is readable at a glance. */
function podsFor(tier: number, spanT: number, spanB: number): Pod[] {
  const pods: Pod[] = []
  const pair = (x: number, y: number, len: number) => {
    pods.push({ x, y: -y * spanT, len }, { x, y: y * spanB, len })
  }
  if (tier >= 2) pair(-4, 9, 9)
  if (tier >= 3) pair(-8, 15, 8)
  if (tier >= 4) pair(9, 6.2, 6) // nose canard pods
  if (tier >= 5) pair(-15, 5.5, 6) // rear guns (tier 5+ fires backwards)
  if (tier >= 6) pair(-1, 13, 7)
  return pods
}

function drawShip(g: Phaser.GameObjects.Graphics, tier: number, bank: ShipBank) {
  const B = SHIP.bake
  const c = (SHIP.box / 2) * B
  const P = (pts: Pt[]) => pts.map(([x, y]) => new Phaser.Math.Vector2(c + x * B, c + y * B))
  const spanT = bank < 0 ? 0.78 : bank > 0 ? 1.08 : 1
  const spanB = bank > 0 ? 0.78 : bank < 0 ? 1.08 : 1
  const shapes = shapesFor(tier, bank)
  const pods = podsFor(tier, spanT, spanB)
  const capsule = (p: Pod, grow: number) =>
    g.fillRoundedRect(c + (p.x - p.len / 2 - grow) * B, c + (p.y - 1.8 - grow) * B, (p.len + grow * 2) * B, (3.6 + grow * 2) * B, (1.8 + grow) * B)

  // Pass 1: outline everything (thick dark navy)
  g.fillStyle(SHIP.outline, 1)
  g.lineStyle(2.6 * B, SHIP.outline, 1)
  for (const s of shapes) {
    g.fillPoints(P(s.pts), true)
    g.strokePoints(P(s.pts), true, true)
  }

  // Pass 2: fills
  for (const s of shapes) {
    g.fillStyle(s.fill, 1)
    g.fillPoints(P(s.pts), true)
  }
  // Spine highlight
  g.fillStyle(SHIP.hullLight, 1)
  g.fillPoints(P([[18, -0.6], [2, -2.2], [-10, -1.2], [-10, 0.4], [2, 0.6], [18, 0.4]]), true)
  // Gold leading edges on wings
  g.lineStyle(1.3 * B, SHIP.gold, 1)
  g.lineBetween(c + 4 * B, c - 4 * B, c - 8.5 * B, c - 18.5 * spanT * B)
  g.lineBetween(c + 4 * B, c + 4 * B, c - 8.5 * B, c + 18.5 * spanB * B)
  // Gold tail tips
  g.fillStyle(SHIP.goldDeep, 1)
  g.fillCircle(c - 19 * B, c - 7.6 * B, 1.1 * B)
  g.fillCircle(c - 19 * B, c + 7.6 * B, 1.1 * B)
  // Pods (outlined on top of the wings so each reads separately)
  g.fillStyle(SHIP.outline, 1)
  for (const p of pods) capsule(p, 1.1)
  for (const p of pods) {
    g.fillStyle(SHIP.pod, 1)
    capsule(p, 0)
    g.fillStyle(SHIP.gold, 1)
    g.fillCircle(c + (p.x + p.len / 2 - 0.8) * B, c + p.y * B, 1.3 * B)
  }
  // Canopy (gold visor) + glint
  g.fillStyle(SHIP.outline, 1)
  g.fillEllipse(c + 8 * B, c, 10 * B, 5.6 * B)
  g.fillStyle(SHIP.gold, 1)
  g.fillEllipse(c + 8 * B, c, 8 * B, 3.8 * B)
  g.fillStyle(0xfff7d6, 1)
  g.fillEllipse(c + 9.6 * B, c - 0.8 * B, 2.6 * B, 1.1 * B)
  // Tier 6: quantum core at the nose
  if (tier >= 6) {
    g.fillStyle(SHIP.core, 1)
    g.fillCircle(c + 17 * B, c, 1.3 * B)
  }
}

function drawFlame(g: Phaser.GameObjects.Graphics, i: number) {
  const B = SHIP.bake
  const h = 16 * B
  const len = [13, 16, 11][i] * B
  const w = [4.2, 4.8, 3.8][i] * B
  // Box 24×16: flame base on the right edge, plume pointing left (-X)
  const bx = 24 * B
  g.fillStyle(0x22d3ee, 0.35)
  g.fillTriangle(bx, h / 2 - w, bx, h / 2 + w, bx - len, h / 2)
  g.fillStyle(SHIP.core, 0.85)
  g.fillTriangle(bx, h / 2 - w * 0.6, bx, h / 2 + w * 0.6, bx - len * 0.7, h / 2)
  g.fillStyle(0xffffff, 0.95)
  g.fillTriangle(bx, h / 2 - w * 0.28, bx, h / 2 + w * 0.28, bx - len * 0.38, h / 2)
}

export function ensureShipTextures(scene: Phaser.Scene) {
  const B = SHIP.bake
  for (let t = 1; t <= 6; t++) {
    for (const b of BANKS) {
      const key = shipKey(t, b)
      if (scene.textures.exists(key)) continue
      const g = scene.make.graphics({ x: 0, y: 0 }, false)
      drawShip(g, t, b)
      g.generateTexture(key, SHIP.box * B, SHIP.box * B)
      g.destroy()
    }
  }
  SHIP_FLAME_KEYS.forEach((key, i) => {
    if (scene.textures.exists(key)) return
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    drawFlame(g, i)
    g.generateTexture(key, 24 * B, 16 * B)
    g.destroy()
  })
}

export type ShipSprite = {
  root: Phaser.GameObjects.Container
  hull: Phaser.GameObjects.Image
  flame: Phaser.GameObjects.Image
  shieldRing: Phaser.GameObjects.Arc
  tier: number
  bank: ShipBank
  bankHold: number
  flameT: number
  flameIdx: number
}

export function createShipSprite(scene: Phaser.Scene, x: number, y: number, depth: number): ShipSprite {
  ensureShipTextures(scene)
  const inv = SHIP_VISUAL_SCALE / SHIP.bake
  const flame = scene.add.image(-12 * SHIP_VISUAL_SCALE, 0, SHIP_FLAME_KEYS[0]).setOrigin(1, 0.5).setScale(inv)
  const hull = scene.add.image(0, 0, shipKey(1, 0)).setScale(inv)
  const shieldRing = scene.add.circle(0, 0, 30, 0xa78bfa, 0).setStrokeStyle(2.5, 0xa78bfa, 0)
  const root = scene.add.container(x, y, [flame, hull, shieldRing]).setDepth(depth)
  return { root, hull, flame, shieldRing, tier: 1, bank: 0, bankHold: 0, flameT: 0, flameIdx: 0 }
}

export function setShipTier(s: ShipSprite, tier: number) {
  s.tier = Math.max(1, Math.min(6, Math.floor(tier)))
  s.hull.setTexture(shipKey(s.tier, s.bank))
}

/**
 * turnRate: deg/frame of heading change (sign → bank side).
 * thrust: 0..~2 plume strength (speed, fire boost).
 */
export function animateShipSprite(s: ShipSprite, deltaMs: number, turnRate: number, thrust: number) {
  // Bank with a little hysteresis so it doesn't chatter
  const want: ShipBank = turnRate < -0.6 ? -1 : turnRate > 0.6 ? 1 : 0
  if (want !== 0) s.bankHold = 140
  else s.bankHold = Math.max(0, s.bankHold - deltaMs)
  const bank: ShipBank = want !== 0 ? want : s.bankHold > 0 ? s.bank : 0
  if (bank !== s.bank) {
    s.bank = bank
    s.hull.setTexture(shipKey(s.tier, bank))
  }
  // Thruster flicker: 3 baked frames ~22 fps, length follows thrust
  s.flameT += deltaMs
  if (s.flameT >= 45) {
    s.flameT = 0
    s.flameIdx = (s.flameIdx + 1 + Math.floor(Math.random() * 2)) % 3
    s.flame.setTexture(SHIP_FLAME_KEYS[s.flameIdx])
  }
  const k = Math.max(0.45, Math.min(1.6, thrust))
  s.flame.setScale((k * SHIP_VISUAL_SCALE) / SHIP.bake, ((0.8 + k * 0.2) * SHIP_VISUAL_SCALE) / SHIP.bake)
  s.flame.setAlpha(0.55 + 0.4 * Math.min(1, k))
}
