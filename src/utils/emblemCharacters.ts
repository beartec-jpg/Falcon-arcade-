import Phaser from 'phaser'

/** Portal brand + accent palette for emblem characters. */
export const EMBLEM = {
  bronze: 0xc07838,
  bright: 0xd4922a,
  dark: 0xa06030,
  deep: 0x6b3f1a,
  ink: 0x020617,
  slate: 0x0f172a,
  line: 0xf0c14a,
  quantum: 0x22d3ee,
  quantumHot: 0x67e8f9,
  shield: 0xa78bfa,
  danger: 0xf87171,
  white: 0xf1f5f9,
} as const

export type CharacterMood = 'idle' | 'play' | 'boost' | 'shield' | 'danger' | 'dead'

// ── Falcon Flight: premium quantum interceptor ───────────

export type FlightEmblem = {
  root: Phaser.GameObjects.Container
  /** Outer soft aura */
  glow: Phaser.GameObjects.Arc
  ring: Phaser.GameObjects.Arc
  /** Rear thruster stack */
  thrusterPlume: Phaser.GameObjects.Triangle
  thrusterPlumeCore: Phaser.GameObjects.Triangle
  thrusterHalo: Phaser.GameObjects.Arc
  thrusterHousing: Phaser.GameObjects.Rectangle
  thrusterCore: Phaser.GameObjects.Rectangle
  /** Tail streamers */
  tailFar: Phaser.GameObjects.Triangle
  tailMid: Phaser.GameObjects.Triangle
  tailNear: Phaser.GameObjects.Triangle
  /** Wing groups (pivots for natural flap) */
  wingTopGroup: Phaser.GameObjects.Container
  wingBotGroup: Phaser.GameObjects.Container
  wingTopPrimary: Phaser.GameObjects.Triangle
  wingBotPrimary: Phaser.GameObjects.Triangle
  /** Body stack */
  bodyShadow: Phaser.GameObjects.Triangle
  body: Phaser.GameObjects.Triangle
  bodyHighlight: Phaser.GameObjects.Triangle
  core: Phaser.GameObjects.Triangle
  ridge: Phaser.GameObjects.Rectangle
  ledgerLineA: Phaser.GameObjects.Rectangle
  ledgerLineB: Phaser.GameObjects.Rectangle
  energyLine: Phaser.GameObjects.Rectangle
  energyNode: Phaser.GameObjects.Arc
  /** Head */
  crest: Phaser.GameObjects.Triangle
  head: Phaser.GameObjects.Triangle
  headCap: Phaser.GameObjects.Arc
  eyeSocket: Phaser.GameObjects.Arc
  eye: Phaser.GameObjects.Arc
  eyeGlint: Phaser.GameObjects.Arc
  eyeGlow: Phaser.GameObjects.Arc
  beakUpper: Phaser.GameObjects.Triangle
  beakLower: Phaser.GameObjects.Triangle
  beakEdge: Phaser.GameObjects.Triangle
  visor: Phaser.GameObjects.Rectangle
  parts: Phaser.GameObjects.Shape[]
}

export type FlightAnimOpts = {
  /** Vertical velocity (px/s) — drives flap aggression + pitch feel */
  vy?: number
  /** ~1 at base scroll, higher when sped up — thruster intensity */
  speedFactor?: number
}

/**
 * Premium multi-layer geometric falcon for Falcon Flight.
 * Facing right; trail attaches behind thruster (left). Hitbox stays separate.
 */
export function createFlightEmblem(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 11,
): FlightEmblem {
  const root = scene.add.container(x, y).setDepth(depth)

  // ── Auras ──────────────────────────────────────────────
  const ring = scene.add.circle(4, 0, 42, EMBLEM.bright, 0.04)
  ring.setStrokeStyle(1.5, EMBLEM.line, 0.22)
  const glow = scene.add.circle(2, 0, 32, EMBLEM.bronze, 0.2)

  // ── Thruster (rear / left) ──────────────────────────────
  const thrusterHalo = scene.add.circle(-22, 0, 11, EMBLEM.quantum, 0.18)
  const thrusterPlume = scene.add.triangle(
    -28,
    0,
    6,
    -9,
    6,
    9,
    -18,
    0,
    EMBLEM.quantum,
    0.5,
  )
  const thrusterPlumeCore = scene.add.triangle(
    -26,
    0,
    4,
    -4.5,
    4,
    4.5,
    -14,
    0,
    EMBLEM.quantumHot,
    0.85,
  )
  const thrusterHousing = scene.add.rectangle(-16, 0, 10, 14, EMBLEM.deep)
  thrusterHousing.setStrokeStyle(1, EMBLEM.bronze, 0.7)
  const thrusterCore = scene.add.rectangle(-17, 0, 5, 8, EMBLEM.quantumHot, 0.95)
  const thrusterRim = scene.add.rectangle(-12, 0, 3, 16, EMBLEM.bright, 0.9)

  // ── Tail streamers ─────────────────────────────────────
  const tailFar = scene.add.triangle(-24, 0, 2, -12, 2, 12, -18, 0, EMBLEM.deep, 0.95)
  const tailMid = scene.add.triangle(-20, 0, 1, -9, 1, 9, -15, 0, EMBLEM.dark)
  const tailNear = scene.add.triangle(-15, 0, 0, -5.5, 0, 5.5, -11, 0, EMBLEM.bronze)
  const tailAccent = scene.add.triangle(-17, 0, 0, -2.5, 0, 2.5, -9, 0, EMBLEM.line, 0.55)

  // ── Top wing group (pivot near shoulder) ───────────────
  const wingTopGroup = scene.add.container(-1, -6)
  const wtShadow = scene.add.triangle(2, 2, -10, 2, 14, 4, -4, 30, EMBLEM.deep, 0.9)
  const wtPrimary = scene.add.triangle(0, 0, -12, 0, 16, -2, -6, 28, EMBLEM.bright)
  const wtMid = scene.add.triangle(-4, 6, -6, -2, 10, 0, -10, 22, EMBLEM.bronze)
  const wtFeatherA = scene.add.triangle(-8, 14, -2, -4, 6, -2, -8, 26, EMBLEM.dark)
  const wtFeatherB = scene.add.triangle(-2, 18, 0, -3, 8, -1, -4, 32, EMBLEM.deep)
  const wtTip = scene.add.triangle(-6, 26, 2, -2, 6, 0, -8, 36, EMBLEM.line, 0.75)
  const wtVein = scene.add.rectangle(2, 12, 1.5, 20, EMBLEM.line, 0.35)
  wtVein.setAngle(18)
  wingTopGroup.add([wtShadow, wtPrimary, wtMid, wtFeatherA, wtFeatherB, wtTip, wtVein])

  // ── Bottom wing group ──────────────────────────────────
  const wingBotGroup = scene.add.container(-1, 6)
  const wbShadow = scene.add.triangle(2, -2, -10, -2, 14, -4, -4, -30, EMBLEM.deep, 0.9)
  const wbPrimary = scene.add.triangle(0, 0, -12, 0, 16, 2, -6, -28, EMBLEM.dark)
  const wbMid = scene.add.triangle(-4, -6, -6, 2, 10, 0, -10, -22, EMBLEM.bronze)
  const wbFeatherA = scene.add.triangle(-8, -14, -2, 4, 6, 2, -8, -26, EMBLEM.deep)
  const wbFeatherB = scene.add.triangle(-2, -18, 0, 3, 8, 1, -4, -32, EMBLEM.dark)
  const wbTip = scene.add.triangle(-6, -26, 2, 2, 6, 0, -8, -36, EMBLEM.line, 0.65)
  const wbVein = scene.add.rectangle(2, -12, 1.5, 20, EMBLEM.line, 0.3)
  wbVein.setAngle(-18)
  wingBotGroup.add([wbShadow, wbPrimary, wbMid, wbFeatherA, wbFeatherB, wbTip, wbVein])

  // ── Body hull (chevron stack, points right) ─────────────
  const bodyShadow = scene.add.triangle(2, 2, -16, -15, -16, 15, 28, 2, EMBLEM.deep)
  const body = scene.add.triangle(2, 0, -15, -13, -15, 13, 28, 0, EMBLEM.bronze)
  const bodyHighlight = scene.add.triangle(
    4,
    -2,
    -10,
    -9,
    -8,
    -1,
    18,
    -3,
    EMBLEM.bright,
    0.55,
  )
  const core = scene.add.triangle(3, 0, -8, -7, -8, 7, 18, 0, EMBLEM.bright)
  const belly = scene.add.triangle(0, 4, -10, 2, -10, 10, 12, 5, EMBLEM.dark, 0.55)

  // Metallic ridge + ledger accents
  const ridge = scene.add.rectangle(4, -1, 22, 2, EMBLEM.line, 0.85)
  const ledgerLineA = scene.add.rectangle(2, 3, 16, 1.2, EMBLEM.line, 0.4)
  const ledgerLineB = scene.add.rectangle(0, 5.5, 12, 1, EMBLEM.line, 0.28)
  const energyLine = scene.add.rectangle(5, 0, 20, 2.2, EMBLEM.quantum, 0.75)
  const energyNode = scene.add.circle(16, 0, 2.8, EMBLEM.quantumHot, 0.95)
  energyNode.setStrokeStyle(1, EMBLEM.white, 0.35)
  const plate = scene.add.rectangle(-4, 0, 6, 10, EMBLEM.dark, 0.55)
  plate.setStrokeStyle(1, EMBLEM.bronze, 0.5)

  // ── Head / beak (aggressive silhouette) ────────────────
  const crest = scene.add.triangle(12, -12, 0, 5, 8, 2, -4, -10, EMBLEM.dark)
  const crestEdge = scene.add.triangle(13, -13, 1, 2, 6, 0, -1, -9, EMBLEM.line, 0.55)
  // Angular head plate (not a soft blob)
  const head = scene.add.triangle(20, -1, -6, -9, -4, 8, 12, 1, EMBLEM.bright)
  const headCap = scene.add.circle(18, -3, 6.5, EMBLEM.bronze, 0.95)
  headCap.setStrokeStyle(1.5, EMBLEM.line, 0.7)
  const jaw = scene.add.triangle(22, 3, -4, -2, -2, 6, 10, 4, EMBLEM.dark, 0.85)

  // Eye stack: glow → socket → iris → glint
  const eyeGlow = scene.add.circle(21, -3, 5.5, EMBLEM.quantum, 0.28)
  const eyeSocket = scene.add.circle(21, -3, 4.2, EMBLEM.ink, 1)
  eyeSocket.setStrokeStyle(1.2, EMBLEM.line, 0.55)
  const eye = scene.add.circle(21.5, -3, 2.6, EMBLEM.quantum, 1)
  const eyePupil = scene.add.circle(22.2, -3, 1.2, EMBLEM.ink, 0.95)
  const eyeGlint = scene.add.circle(20.6, -4, 1.1, EMBLEM.white, 0.95)

  const visor = scene.add.rectangle(20, -2.5, 8, 3.2, EMBLEM.quantum, 0.35)

  // Dual beak for sharpness
  const beakUpper = scene.add.triangle(30, -1, 0, -3.2, 0, 1.5, 14, -0.5, EMBLEM.line)
  const beakLower = scene.add.triangle(28, 2, 0, -1.5, 0, 3.2, 11, 1.5, EMBLEM.dark)
  const beakEdge = scene.add.triangle(31, 0, 0, -1.6, 0, 1.2, 10, 0, EMBLEM.white, 0.55)

  // ── Assemble (painter’s order) ─────────────────────────
  root.add([
    ring,
    glow,
    thrusterHalo,
    thrusterPlume,
    thrusterPlumeCore,
    thrusterHousing,
    thrusterCore,
    thrusterRim,
    tailFar,
    tailMid,
    tailNear,
    tailAccent,
    wingBotGroup,
    wingTopGroup,
    bodyShadow,
    belly,
    body,
    bodyHighlight,
    core,
    plate,
    ridge,
    ledgerLineA,
    ledgerLineB,
    energyLine,
    energyNode,
    crest,
    crestEdge,
    jaw,
    head,
    headCap,
    eyeGlow,
    eyeSocket,
    eye,
    eyePupil,
    eyeGlint,
    visor,
    beakLower,
    beakUpper,
    beakEdge,
  ])

  const parts: Phaser.GameObjects.Shape[] = [
    body,
    core,
    wtPrimary,
    wbPrimary,
    tailMid,
    head,
    headCap,
    energyLine,
    thrusterHousing,
  ]

  return {
    root,
    glow,
    ring,
    thrusterPlume,
    thrusterPlumeCore,
    thrusterHalo,
    thrusterHousing,
    thrusterCore,
    tailFar,
    tailMid,
    tailNear,
    wingTopGroup,
    wingBotGroup,
    wingTopPrimary: wtPrimary,
    wingBotPrimary: wbPrimary,
    bodyShadow,
    body,
    bodyHighlight,
    core,
    ridge,
    ledgerLineA,
    ledgerLineB,
    energyLine,
    energyNode,
    crest,
    head,
    headCap,
    eyeSocket,
    eye,
    eyeGlint,
    eyeGlow,
    beakUpper,
    beakLower,
    beakEdge,
    visor,
    parts,
  }
}

/**
 * Wing flap, thruster heat, eye glint, and pitch — driven by mood + flight state.
 */
export function animateFlightEmblem(
  e: FlightEmblem,
  delta: number,
  t: number,
  mood: CharacterMood,
  pitch = 0,
  opts: FlightAnimOpts = {},
) {
  const vy = opts.vy ?? 0
  const speed = opts.speedFactor ?? 1
  const playing = mood === 'play' || mood === 'boost'
  const dead = mood === 'dead'

  // Flap: base sine + vertical intent (dive/climb opens wings more)
  const flapAmp = dead
    ? 0.8
    : playing
      ? 5.5 + Math.min(4, Math.abs(vy) / 90)
      : 3.2
  const flapHz = playing ? 78 : 110
  const flap = Math.sin(t / flapHz) * flapAmp
  // Asymmetric secondary phase for organic feel
  const flap2 = Math.sin(t / flapHz + 0.55) * flapAmp * 0.55

  // Rotate wing groups around shoulders (not just y-bob)
  const topAngle = -flap * 1.15 + Phaser.Math.Clamp(-vy / 40, -6, 6)
  const botAngle = flap * 1.15 + Phaser.Math.Clamp(vy / 40, -6, 6)
  e.wingTopGroup.angle = Phaser.Math.Linear(e.wingTopGroup.angle, topAngle, 0.22)
  e.wingBotGroup.angle = Phaser.Math.Linear(e.wingBotGroup.angle, botAngle, 0.22)
  e.wingTopGroup.y = -6 - flap * 0.15
  e.wingBotGroup.y = 6 + flap * 0.15
  e.wingTopPrimary.x = flap2 * 0.12
  e.wingBotPrimary.x = -flap2 * 0.12

  // Tail streams with thruster wake
  const wake = Math.sin(t / 95) * (1.2 + speed * 0.8)
  e.tailFar.x = -24 - wake * 1.4
  e.tailMid.x = -20 - wake
  e.tailNear.x = -15 - wake * 0.55
  e.tailFar.angle = wake * 0.8
  e.tailMid.angle = -wake * 0.5

  // Thruster: brighter / longer with speed and boost
  const thrust =
    dead
      ? 0.25
      : Phaser.Math.Clamp(
          0.55 + (speed - 1) * 0.55 + (mood === 'boost' ? 0.35 : 0),
          0.4,
          1.65,
        )
  const pulse = 0.85 + Math.sin(t / 55) * 0.15
  e.thrusterPlume.setScale(thrust * pulse, 0.75 + thrust * 0.35)
  e.thrusterPlume.setAlpha(0.28 + thrust * 0.35)
  e.thrusterPlumeCore.setScale(thrust * pulse * 0.9, 0.7 + thrust * 0.4)
  e.thrusterPlumeCore.setAlpha(0.55 + thrust * 0.35)
  e.thrusterCore.setAlpha(0.65 + Math.sin(t / 48) * 0.3 * thrust)
  e.thrusterHalo.setScale(0.85 + thrust * 0.35 + Math.sin(t / 70) * 0.08)
  e.thrusterHalo.setAlpha(0.1 + thrust * 0.18)

  // Body aura + ring
  e.glow.setScale(1 + Math.sin(t / 145) * 0.08 + (mood === 'boost' ? 0.08 : 0))
  e.ring.setScale(1 + Math.sin(t / 190) * 0.05)
  e.ring.setAlpha(mood === 'boost' ? 0.2 : playing ? 0.08 : 0.05)

  // Energy conduit shimmer
  e.energyLine.setAlpha(0.45 + Math.sin(t / 90) * 0.4)
  e.energyNode.setScale(0.9 + Math.sin(t / 70) * 0.2)
  e.ridge.setAlpha(0.55 + Math.sin(t / 160) * 0.25)
  e.ledgerLineA.setAlpha(0.25 + Math.sin(t / 200) * 0.2)
  e.ledgerLineB.setAlpha(0.18 + Math.sin(t / 220 + 1) * 0.15)

  // Eye glint + soft glow
  e.eye.setAlpha(0.75 + Math.sin(t / 100) * 0.25)
  e.eyeGlint.setAlpha(0.55 + Math.sin(t / 85) * 0.4)
  e.eyeGlint.x = 20.6 + Math.sin(t / 130) * 0.35
  e.eyeGlow.setAlpha(
    dead ? 0.05 : 0.18 + Math.sin(t / 110) * 0.12 + (mood === 'boost' ? 0.1 : 0),
  )
  e.visor.setAlpha(0.25 + Math.sin(t / 120) * 0.2)

  // Pitch body toward climb/dive
  const targetPitch = dead ? 18 : pitch
  e.root.angle = Phaser.Math.Linear(e.root.angle, targetPitch, 0.16)

  applyMoodTint(e.parts, e.glow, mood)
  void delta
}

// ── Ledger Runner: armored ledger courier ────────────────

export type RunnerEmblem = {
  root: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Arc
  ring: Phaser.GameObjects.Arc
  // Cape / shoulders
  cape: Phaser.GameObjects.Triangle
  capeMid: Phaser.GameObjects.Triangle
  capeTip: Phaser.GameObjects.Triangle
  pauldronL: Phaser.GameObjects.Triangle
  pauldronR: Phaser.GameObjects.Triangle
  // Legs (groups for proper run cycle)
  legLGroup: Phaser.GameObjects.Container
  legRGroup: Phaser.GameObjects.Container
  thighL: Phaser.GameObjects.Rectangle
  shinL: Phaser.GameObjects.Rectangle
  bootL: Phaser.GameObjects.Rectangle
  thighR: Phaser.GameObjects.Rectangle
  shinR: Phaser.GameObjects.Rectangle
  bootR: Phaser.GameObjects.Rectangle
  // Arm
  armGroup: Phaser.GameObjects.Container
  arm: Phaser.GameObjects.Rectangle
  gauntlet: Phaser.GameObjects.Rectangle
  // Torso armor
  torsoGroup: Phaser.GameObjects.Container
  torso: Phaser.GameObjects.Rectangle
  chestPlate: Phaser.GameObjects.Rectangle
  core: Phaser.GameObjects.Arc
  coreRing: Phaser.GameObjects.Arc
  ledgerA: Phaser.GameObjects.Rectangle
  ledgerB: Phaser.GameObjects.Rectangle
  ledgerC: Phaser.GameObjects.Rectangle
  // Head
  headGroup: Phaser.GameObjects.Container
  head: Phaser.GameObjects.Arc
  helm: Phaser.GameObjects.Ellipse
  crest: Phaser.GameObjects.Triangle
  visor: Phaser.GameObjects.Rectangle
  visorGlow: Phaser.GameObjects.Rectangle
  eyeGlint: Phaser.GameObjects.Arc
  parts: Phaser.GameObjects.Shape[]
}

export type RunnerAnimOpts = {
  onGround: boolean
  sliding: boolean
  runBob: number
  /** Vertical velocity for jump pose */
  vy?: number
  /** ~1 base run speed — faster gait */
  speedFactor?: number
}

/**
 * Premium armored runner — facing right, gold/bronze ledger armor.
 * Hitbox stays on the physics body; this is pure visual.
 */
export function createRunnerEmblem(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 11,
): RunnerEmblem {
  const root = scene.add.container(x, y).setDepth(depth)

  const glow = scene.add.circle(0, 4, 30, EMBLEM.bronze, 0.16)
  const ring = scene.add.circle(0, 2, 34, EMBLEM.bright, 0.04)
  ring.setStrokeStyle(1.2, EMBLEM.line, 0.2)

  // ── Cape (rear / left stream) ──────────────────────────
  const cape = scene.add.triangle(-14, 0, 4, -16, 6, 14, -22, 6, EMBLEM.dark)
  const capeMid = scene.add.triangle(-18, 4, 3, -10, 4, 12, -20, 12, EMBLEM.deep)
  const capeTip = scene.add.triangle(-26, 10, 4, -6, 5, 8, -16, 16, EMBLEM.bronze, 0.85)
  const capeEdge = scene.add.triangle(-22, 8, 2, -4, 3, 4, -12, 10, EMBLEM.line, 0.4)

  // ── Legs (hip-pivot containers) ────────────────────────
  const legLGroup = scene.add.container(-5, 10)
  const thighL = scene.add.rectangle(0, 4, 7, 12, EMBLEM.dark)
  thighL.setStrokeStyle(1, EMBLEM.bronze, 0.45)
  const shinL = scene.add.rectangle(0, 14, 6, 12, EMBLEM.deep)
  const bootL = scene.add.rectangle(1, 22, 10, 6, EMBLEM.bronze)
  bootL.setStrokeStyle(1, EMBLEM.line, 0.5)
  const kneeL = scene.add.circle(0, 9, 2.5, EMBLEM.bright, 0.7)
  legLGroup.add([thighL, shinL, kneeL, bootL])

  const legRGroup = scene.add.container(5, 10)
  const thighR = scene.add.rectangle(0, 4, 7, 12, EMBLEM.bronze)
  thighR.setStrokeStyle(1, EMBLEM.line, 0.4)
  const shinR = scene.add.rectangle(0, 14, 6, 12, EMBLEM.dark)
  const bootR = scene.add.rectangle(1, 22, 10, 6, EMBLEM.bright)
  bootR.setStrokeStyle(1, EMBLEM.line, 0.55)
  const kneeR = scene.add.circle(0, 9, 2.5, EMBLEM.line, 0.65)
  legRGroup.add([thighR, shinR, kneeR, bootR])

  // ── Torso armor stack ──────────────────────────────────
  const torsoGroup = scene.add.container(0, -2)
  const torsoShadow = scene.add.rectangle(1.5, 2, 24, 28, EMBLEM.deep)
  const torso = scene.add.rectangle(0, 0, 22, 26, EMBLEM.bronze)
  torso.setStrokeStyle(1.5, EMBLEM.line, 0.45)
  const chestPlate = scene.add.rectangle(0, -3, 16, 12, EMBLEM.bright, 0.75)
  chestPlate.setStrokeStyle(1, EMBLEM.line, 0.55)
  const abdomen = scene.add.rectangle(0, 8, 14, 8, EMBLEM.dark, 0.65)
  const core = scene.add.circle(0, 1, 4.2, EMBLEM.line, 0.95)
  const coreRing = scene.add.circle(0, 1, 6, EMBLEM.quantum, 0)
  coreRing.setStrokeStyle(1.4, EMBLEM.quantum, 0.75)
  // Circuit / ledger lines on plate
  const ledgerA = scene.add.rectangle(-3, -6, 10, 1.4, EMBLEM.line, 0.85)
  const ledgerB = scene.add.rectangle(3, -3, 8, 1.2, EMBLEM.quantum, 0.55)
  const ledgerC = scene.add.rectangle(0, 5, 12, 1.1, EMBLEM.line, 0.45)
  const rivetL = scene.add.circle(-8, -8, 1.4, EMBLEM.line, 0.7)
  const rivetR = scene.add.circle(8, -8, 1.4, EMBLEM.line, 0.7)
  torsoGroup.add([
    torsoShadow,
    torso,
    abdomen,
    chestPlate,
    core,
    coreRing,
    ledgerA,
    ledgerB,
    ledgerC,
    rivetL,
    rivetR,
  ])

  // Pauldrons
  const pauldronL = scene.add.triangle(-12, -10, 6, 4, -4, 8, -8, -6, EMBLEM.dark)
  const pauldronR = scene.add.triangle(12, -10, -6, 4, 4, 8, 8, -6, EMBLEM.bright)

  // ── Arm (front) ────────────────────────────────────────
  const armGroup = scene.add.container(12, -4)
  const arm = scene.add.rectangle(0, 6, 6.5, 16, EMBLEM.bright)
  arm.setStrokeStyle(1, EMBLEM.line, 0.4)
  const gauntlet = scene.add.rectangle(0, 14, 8, 7, EMBLEM.dark)
  gauntlet.setStrokeStyle(1, EMBLEM.bronze, 0.6)
  const fist = scene.add.circle(0, 18, 3.2, EMBLEM.bronze, 0.9)
  armGroup.add([arm, gauntlet, fist])

  // ── Helmet / visor ─────────────────────────────────────
  const headGroup = scene.add.container(0, -18)
  const crest = scene.add.triangle(0, -12, -5, 5, 5, 5, 0, -8, EMBLEM.bronze)
  const crestEdge = scene.add.triangle(0, -13, -3, 3, 3, 3, 0, -6, EMBLEM.line, 0.65)
  const head = scene.add.circle(0, 0, 10.5, EMBLEM.bright)
  head.setStrokeStyle(1.5, EMBLEM.line, 0.55)
  const helm = scene.add.ellipse(0, -3, 20, 11, EMBLEM.dark, 0.45)
  const cheekL = scene.add.triangle(-8, 2, 3, -4, 3, 6, -6, 4, EMBLEM.dark, 0.7)
  const cheekR = scene.add.triangle(8, 2, -3, -4, -3, 6, 6, 4, EMBLEM.dark, 0.7)
  const visor = scene.add.rectangle(2, 0, 14, 5.5, EMBLEM.ink, 1)
  visor.setStrokeStyle(1, EMBLEM.quantum, 0.5)
  const visorGlow = scene.add.rectangle(2, 0, 11, 3.2, EMBLEM.quantum, 0.9)
  const eyeGlint = scene.add.circle(6, -1, 1.3, EMBLEM.white, 0.95)
  headGroup.add([
    crest,
    crestEdge,
    head,
    helm,
    cheekL,
    cheekR,
    visor,
    visorGlow,
    eyeGlint,
  ])

  root.add([
    ring,
    glow,
    capeTip,
    capeMid,
    cape,
    capeEdge,
    legLGroup,
    legRGroup,
    torsoGroup,
    pauldronL,
    pauldronR,
    armGroup,
    headGroup,
  ])

  const parts: Phaser.GameObjects.Shape[] = [
    torso,
    chestPlate,
    head,
    cape,
    arm,
    core,
  ]

  return {
    root,
    glow,
    ring,
    cape,
    capeMid,
    capeTip,
    pauldronL,
    pauldronR,
    legLGroup,
    legRGroup,
    thighL,
    shinL,
    bootL,
    thighR,
    shinR,
    bootR,
    armGroup,
    arm,
    gauntlet,
    torsoGroup,
    torso,
    chestPlate,
    core,
    coreRing,
    ledgerA,
    ledgerB,
    ledgerC,
    headGroup,
    head,
    helm,
    crest,
    visor,
    visorGlow,
    eyeGlint,
    parts,
  }
}

export function animateRunnerEmblem(
  e: RunnerEmblem,
  delta: number,
  t: number,
  mood: CharacterMood,
  opts: RunnerAnimOpts,
) {
  const dead = mood === 'dead'
  const speed = opts.speedFactor ?? 1
  const vy = opts.vy ?? 0

  if (opts.sliding) {
    // Low armored slide — stretch forward, tuck legs
    e.root.setScale(1.22, 0.48)
    e.legLGroup.angle = 72
    e.legRGroup.angle = 58
    e.legLGroup.y = 6
    e.legRGroup.y = 8
    e.armGroup.angle = -35
    e.armGroup.y = 4
    e.cape.angle = 28
    e.capeMid.angle = 32
    e.capeTip.angle = 38
    e.capeTip.x = -30
    e.torsoGroup.y = 2
    e.headGroup.y = -14
    e.headGroup.angle = 8
    e.pauldronL.angle = 12
    e.pauldronR.angle = -8
    e.visorGlow.setAlpha(1)
    e.coreRing.setAlpha(0.9)
    applyMoodTint(e.parts, e.glow, mood === 'play' ? 'boost' : mood)
    void delta
    return
  }

  e.root.setScale(1, 1)
  e.headGroup.angle = Phaser.Math.Linear(e.headGroup.angle, 0, 0.2)
  e.headGroup.y = -18

  if (opts.onGround && !dead) {
    // Proper opposite-phase run: hips rotate, legs swing
    const gait = opts.runBob / (62 / Math.max(0.85, Math.min(1.6, speed)))
    const swing = Math.sin(gait) * 22
    const swing2 = Math.sin(gait + Math.PI) * 22
    const bob = Math.abs(Math.sin(gait)) * 1.6

    e.legLGroup.angle = Phaser.Math.Linear(e.legLGroup.angle, swing, 0.28)
    e.legRGroup.angle = Phaser.Math.Linear(e.legRGroup.angle, swing2, 0.28)
    e.legLGroup.y = 10 + bob * 0.3
    e.legRGroup.y = 10 + bob * 0.3
    // Knee bend illusion via shin offset
    e.shinL.y = 14 + Math.max(0, -swing) * 0.06
    e.shinR.y = 14 + Math.max(0, -swing2) * 0.06

    e.armGroup.angle = Phaser.Math.Linear(e.armGroup.angle, -swing * 0.85, 0.25)
    e.armGroup.y = -4 + bob * 0.2
    e.torsoGroup.y = -2 + bob * 0.35
    e.torsoGroup.angle = swing * 0.08
    e.headGroup.y = -18 + bob * 0.2
    e.pauldronL.angle = -swing * 0.12
    e.pauldronR.angle = swing * 0.12

    // Cape flows opposite stride
    e.cape.angle = -swing * 0.35 - 8
    e.capeMid.angle = -swing * 0.45 - 6
    e.capeTip.angle = -swing * 0.55 - 4
    e.capeTip.x = -26 - Math.abs(swing) * 0.12
  } else if (!dead) {
    // Jump / air pose — legs tuck slightly, cape lifts
    const tuck = Phaser.Math.Clamp(vy / 80, -8, 14)
    e.legLGroup.angle = Phaser.Math.Linear(e.legLGroup.angle, -18 + tuck, 0.15)
    e.legRGroup.angle = Phaser.Math.Linear(e.legRGroup.angle, 14 + tuck * 0.5, 0.15)
    e.legLGroup.y = 8
    e.legRGroup.y = 12
    e.armGroup.angle = Phaser.Math.Linear(e.armGroup.angle, -25, 0.12)
    e.cape.angle = 14
    e.capeMid.angle = 18
    e.capeTip.angle = 22
    e.capeTip.x = -28
    e.torsoGroup.y = -3
    e.torsoGroup.angle = 0
  } else {
    e.legLGroup.angle = 10
    e.legRGroup.angle = -8
    e.armGroup.angle = 20
    e.cape.angle = -4
  }

  // Idle/run pulses
  e.visorGlow.setAlpha(0.5 + Math.sin(t / 100) * 0.45)
  e.eyeGlint.setAlpha(0.45 + Math.sin(t / 80) * 0.5)
  e.eyeGlint.x = 6 + Math.sin(t / 140) * 0.4
  e.core.setScale(0.92 + Math.sin(t / 120) * 0.14)
  e.coreRing.setAlpha(0.45 + Math.sin(t / 95) * 0.4)
  e.ledgerA.setAlpha(0.55 + Math.sin(t / 160) * 0.3)
  e.ledgerB.setAlpha(0.35 + Math.sin(t / 140 + 1) * 0.35)
  e.glow.setScale(1 + Math.sin(t / 155) * 0.07)
  e.ring.setScale(1 + Math.sin(t / 200) * 0.05)
  e.ring.setAlpha(mood === 'boost' ? 0.14 : 0.05)

  applyMoodTint(e.parts, e.glow, mood)
  void delta
}

// ── Epoch Rise: premium vertical quantum falcon ──────────

export type RiseEmblem = {
  root: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Arc
  ring: Phaser.GameObjects.Arc
  // Wings
  wingLGroup: Phaser.GameObjects.Container
  wingRGroup: Phaser.GameObjects.Container
  wingL: Phaser.GameObjects.Triangle
  wingR: Phaser.GameObjects.Triangle
  featherL: Phaser.GameObjects.Triangle
  featherR: Phaser.GameObjects.Triangle
  // Thrusters (bottom / “back” in vertical frame)
  thruster: Phaser.GameObjects.Rectangle
  thrusterCore: Phaser.GameObjects.Rectangle
  thrusterRim: Phaser.GameObjects.Rectangle
  thrusterHalo: Phaser.GameObjects.Arc
  plume: Phaser.GameObjects.Triangle
  plumeCore: Phaser.GameObjects.Triangle
  plumeL: Phaser.GameObjects.Triangle
  plumeR: Phaser.GameObjects.Triangle
  // Body
  body: Phaser.GameObjects.Triangle
  bodyHighlight: Phaser.GameObjects.Triangle
  core: Phaser.GameObjects.Triangle
  ridge: Phaser.GameObjects.Rectangle
  conduitL: Phaser.GameObjects.Rectangle
  conduitR: Phaser.GameObjects.Rectangle
  energyNode: Phaser.GameObjects.Arc
  // Head
  crest: Phaser.GameObjects.Triangle
  head: Phaser.GameObjects.Triangle
  headCap: Phaser.GameObjects.Arc
  eye: Phaser.GameObjects.Arc
  eyeGlint: Phaser.GameObjects.Arc
  eyeGlow: Phaser.GameObjects.Arc
  beak: Phaser.GameObjects.Triangle
  visor: Phaser.GameObjects.Rectangle
  parts: Phaser.GameObjects.Shape[]
}

export type RiseAnimOpts = {
  /** Lateral velocity for wing bank / asymmetric flap */
  vx?: number
  /** Vertical velocity */
  vy?: number
  /** 0–1 energy fill — pulses quantum accents */
  energyRatio?: number
  /** Rise scroll speed factor (~1 base) */
  speedFactor?: number
}

/**
 * Vertical quantum falcon — nose up, thrusters down, wings swept for rise.
 */
export function createRiseEmblem(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 13,
): RiseEmblem {
  const root = scene.add.container(x, y).setDepth(depth)

  const ring = scene.add.circle(0, 2, 40, EMBLEM.quantum, 0.05)
  ring.setStrokeStyle(1.4, EMBLEM.line, 0.22)
  const glow = scene.add.circle(0, 2, 30, EMBLEM.bronze, 0.18)

  // ── Thruster stack (bottom) ────────────────────────────
  const thrusterHalo = scene.add.circle(0, 26, 14, EMBLEM.quantum, 0.16)
  const plume = scene.add.triangle(0, 32, -10, 0, 10, 0, 0, 22, EMBLEM.quantum, 0.5)
  const plumeCore = scene.add.triangle(
    0,
    30,
    -5,
    0,
    5,
    0,
    0,
    16,
    EMBLEM.quantumHot,
    0.85,
  )
  const plumeL = scene.add.triangle(-6, 28, -4, 0, 3, 2, -2, 14, EMBLEM.quantum, 0.4)
  const plumeR = scene.add.triangle(6, 28, 4, 0, -3, 2, 2, 14, EMBLEM.quantum, 0.4)
  const thruster = scene.add.rectangle(0, 18, 14, 12, EMBLEM.deep)
  thruster.setStrokeStyle(1, EMBLEM.bronze, 0.65)
  const thrusterCore = scene.add.rectangle(0, 20, 7, 9, EMBLEM.quantumHot, 0.95)
  const thrusterRim = scene.add.rectangle(0, 14, 16, 3.5, EMBLEM.bright, 0.9)

  // ── Wings (upward-swept, side pivots) ───────────────────
  const wingLGroup = scene.add.container(-10, 2)
  const featherL = scene.add.triangle(-14, 6, 8, -10, 8, 8, -18, 10, EMBLEM.deep)
  const wingL = scene.add.triangle(-2, 0, 6, -12, 6, 10, -20, 4, EMBLEM.bright)
  const wingLMid = scene.add.triangle(-6, 2, 4, -8, 5, 6, -14, 8, EMBLEM.bronze)
  const wingLTip = scene.add.triangle(-16, 8, 4, -4, 5, 2, -12, 14, EMBLEM.line, 0.7)
  const wingLVein = scene.add.rectangle(-4, 2, 1.4, 16, EMBLEM.line, 0.35)
  wingLVein.setAngle(-55)
  wingLGroup.add([featherL, wingL, wingLMid, wingLTip, wingLVein])

  const wingRGroup = scene.add.container(10, 2)
  const featherR = scene.add.triangle(14, 6, -8, -10, -8, 8, 18, 10, EMBLEM.deep)
  const wingR = scene.add.triangle(2, 0, -6, -12, -6, 10, 20, 4, EMBLEM.dark)
  const wingRMid = scene.add.triangle(6, 2, -4, -8, -5, 6, 14, 8, EMBLEM.bronze)
  const wingRTip = scene.add.triangle(16, 8, -4, -4, -5, 2, 12, 14, EMBLEM.line, 0.65)
  const wingRVein = scene.add.rectangle(4, 2, 1.4, 16, EMBLEM.line, 0.3)
  wingRVein.setAngle(55)
  wingRGroup.add([featherR, wingR, wingRMid, wingRTip, wingRVein])

  // ── Body (points up) ───────────────────────────────────
  const bodyShadow = scene.add.triangle(1, 2, 0, -24, -14, 16, 14, 16, EMBLEM.deep)
  const body = scene.add.triangle(0, 0, 0, -24, -13, 14, 13, 14, EMBLEM.bronze)
  const bodyHighlight = scene.add.triangle(
    -1,
    -4,
    0,
    -18,
    -8,
    2,
    2,
    -2,
    EMBLEM.bright,
    0.5,
  )
  const core = scene.add.triangle(0, 0, 0, -14, -7, 8, 7, 8, EMBLEM.bright)
  const ridge = scene.add.rectangle(0, -2, 2.2, 18, EMBLEM.line, 0.8)
  const conduitL = scene.add.rectangle(-4.5, 2, 1.8, 16, EMBLEM.quantum, 0.7)
  const conduitR = scene.add.rectangle(4.5, 2, 1.8, 16, EMBLEM.line, 0.65)
  const energyNode = scene.add.circle(0, 6, 3.4, EMBLEM.quantumHot, 0.95)
  energyNode.setStrokeStyle(1, EMBLEM.white, 0.35)
  const plate = scene.add.rectangle(0, 4, 8, 6, EMBLEM.dark, 0.5)

  // ── Head (top) ─────────────────────────────────────────
  const crest = scene.add.triangle(0, -28, -5, 5, 5, 5, 0, -8, EMBLEM.dark)
  const crestEdge = scene.add.triangle(0, -29, -3, 3, 3, 3, 0, -6, EMBLEM.line, 0.6)
  const head = scene.add.triangle(0, -20, 0, -10, -8, 4, 8, 4, EMBLEM.bright)
  const headCap = scene.add.circle(0, -20, 6.2, EMBLEM.bronze, 0.95)
  headCap.setStrokeStyle(1.4, EMBLEM.line, 0.7)
  const eyeGlow = scene.add.circle(0, -20, 5, EMBLEM.quantum, 0.25)
  const eyeSocket = scene.add.circle(0, -20, 3.6, EMBLEM.ink, 1)
  const eye = scene.add.circle(0, -20, 2.4, EMBLEM.quantum, 1)
  const eyeGlint = scene.add.circle(-1, -21, 1, EMBLEM.white, 0.95)
  const visor = scene.add.rectangle(0, -19, 8, 3, EMBLEM.quantum, 0.35)
  const beak = scene.add.triangle(0, -28, -3, 2, 3, 2, 0, -10, EMBLEM.line)

  root.add([
    ring,
    glow,
    thrusterHalo,
    plumeL,
    plumeR,
    plume,
    plumeCore,
    thruster,
    thrusterCore,
    thrusterRim,
    wingLGroup,
    wingRGroup,
    bodyShadow,
    body,
    bodyHighlight,
    core,
    plate,
    ridge,
    conduitL,
    conduitR,
    energyNode,
    crest,
    crestEdge,
    head,
    headCap,
    eyeGlow,
    eyeSocket,
    eye,
    eyeGlint,
    visor,
    beak,
  ])

  const parts: Phaser.GameObjects.Shape[] = [
    body,
    core,
    wingL,
    wingR,
    head,
    headCap,
    thruster,
    thrusterCore,
  ]

  return {
    root,
    glow,
    ring,
    wingLGroup,
    wingRGroup,
    wingL,
    wingR,
    featherL,
    featherR,
    thruster,
    thrusterCore,
    thrusterRim,
    thrusterHalo,
    plume,
    plumeCore,
    plumeL,
    plumeR,
    body,
    bodyHighlight,
    core,
    ridge,
    conduitL,
    conduitR,
    energyNode,
    crest,
    head,
    headCap,
    eye,
    eyeGlint,
    eyeGlow,
    beak,
    visor,
    parts,
  }
}

export function animateRiseEmblem(
  e: RiseEmblem,
  delta: number,
  t: number,
  mood: CharacterMood,
  bank = 0,
  opts: RiseAnimOpts = {},
) {
  const vx = opts.vx ?? 0
  const vy = opts.vy ?? 0
  const energy = Phaser.Math.Clamp(opts.energyRatio ?? 0.7, 0, 1)
  const speed = opts.speedFactor ?? 1
  const dead = mood === 'dead'
  const boost = mood === 'boost' || mood === 'shield'

  // Wing flap — wider when moving / boosting
  const flapAmp = dead
    ? 1
    : (boost ? 7.5 : 5) + Math.min(3, Math.abs(vx) / 100)
  const flap = Math.sin(t / 88) * flapAmp
  const flap2 = Math.sin(t / 88 + 0.7) * flapAmp * 0.45
  const bankBias = Phaser.Math.Clamp(vx / 35, -10, 10)

  e.wingLGroup.angle = Phaser.Math.Linear(
    e.wingLGroup.angle,
    -flap * 0.9 - bankBias * 0.4,
    0.2,
  )
  e.wingRGroup.angle = Phaser.Math.Linear(
    e.wingRGroup.angle,
    flap * 0.9 - bankBias * 0.4,
    0.2,
  )
  e.wingLGroup.x = -10 - flap * 0.2 + bankBias * 0.15
  e.wingRGroup.x = 10 + flap * 0.2 + bankBias * 0.15
  e.wingL.y = flap2 * 0.1
  e.wingR.y = -flap2 * 0.1

  // Thruster intensity from rise speed, vertical climb, and energy
  const thrustBase =
    dead
      ? 0.3
      : Phaser.Math.Clamp(
          0.65 +
            (speed - 1) * 0.5 +
            Math.max(0, -vy) / 400 +
            energy * 0.35 +
            (boost ? 0.35 : 0),
          0.4,
          1.8,
        )
  const pulse = 0.88 + Math.sin(t / 52) * 0.12
  e.plume.setScale(0.75 + thrustBase * 0.35 * pulse, thrustBase * pulse)
  e.plume.setAlpha(0.28 + thrustBase * 0.35 * energy)
  e.plumeCore.setScale(0.7 + thrustBase * 0.3 * pulse, thrustBase * 0.9 * pulse)
  e.plumeCore.setAlpha(0.5 + thrustBase * 0.4)
  e.plumeL.setScale(0.8, thrustBase * 0.75)
  e.plumeR.setScale(0.8, thrustBase * 0.75)
  e.plumeL.setAlpha(0.2 + thrustBase * 0.25)
  e.plumeR.setAlpha(0.2 + thrustBase * 0.25)
  e.thrusterCore.setAlpha(0.55 + Math.sin(t / 48) * 0.35 * thrustBase)
  e.thrusterHalo.setScale(0.8 + thrustBase * 0.4 + Math.sin(t / 75) * 0.08)
  e.thrusterHalo.setAlpha(0.08 + thrustBase * 0.16 * energy)

  // Energy-driven quantum accents
  const energyPulse = 0.35 + energy * 0.55 + Math.sin(t / 90) * 0.15 * energy
  e.conduitL.setAlpha(energyPulse * (mood === 'danger' ? 0.45 : 0.85))
  e.conduitR.setAlpha(energyPulse * 0.75)
  e.energyNode.setScale(0.75 + energy * 0.45 + Math.sin(t / 70) * 0.12)
  e.energyNode.setAlpha(0.5 + energy * 0.5)
  e.ridge.setAlpha(0.4 + energy * 0.45 + Math.sin(t / 150) * 0.15)

  // Eye + visor
  e.eye.setAlpha(0.7 + Math.sin(t / 100) * 0.3)
  e.eyeGlint.setAlpha(0.5 + Math.sin(t / 85) * 0.45)
  e.eyeGlint.x = -1 + Math.sin(t / 130) * 0.4
  e.eyeGlow.setAlpha(
    dead
      ? 0.04
      : 0.12 + energy * 0.2 + Math.sin(t / 110) * 0.1 + (boost ? 0.12 : 0),
  )
  e.visor.setAlpha(0.2 + Math.sin(t / 115) * 0.2 + energy * 0.15)

  e.glow.setScale(1 + Math.sin(t / 140) * 0.08 + energy * 0.06)
  e.ring.setScale(1 + Math.sin(t / 180) * 0.06)
  e.root.angle = Phaser.Math.Linear(e.root.angle, dead ? 12 : bank, 0.16)

  applyMoodTint(e.parts, e.glow, mood)

  if (mood === 'shield') {
    e.ring.setFillStyle(EMBLEM.shield, 0.22)
    e.glow.setFillStyle(EMBLEM.shield, 0.24)
    e.ring.setAlpha(0.28)
  } else if (mood === 'boost') {
    e.ring.setFillStyle(EMBLEM.bright, 0.16)
    e.glow.setFillStyle(EMBLEM.bright, 0.22)
    e.ring.setAlpha(0.18)
  } else if (mood === 'danger') {
    e.ring.setFillStyle(EMBLEM.danger, 0.14)
    e.glow.setFillStyle(EMBLEM.danger, 0.2)
    e.ring.setAlpha(0.16)
  } else {
    e.ring.setFillStyle(EMBLEM.quantum, 0.06 + energy * 0.08)
    e.glow.setFillStyle(EMBLEM.bronze, 0.14 + energy * 0.08)
    e.ring.setAlpha(0.06 + energy * 0.1)
  }
  void delta
}

// ── Shared mood tint ─────────────────────────────────────

function applyMoodTint(
  parts: Phaser.GameObjects.Shape[],
  glow: Phaser.GameObjects.Arc,
  mood: CharacterMood,
) {
  let glowColor: number = EMBLEM.bronze
  let glowA = 0.16

  switch (mood) {
    case 'boost':
      glowColor = EMBLEM.bright
      glowA = 0.28
      break
    case 'shield':
      glowColor = EMBLEM.shield
      glowA = 0.3
      break
    case 'danger':
      glowColor = EMBLEM.danger
      glowA = 0.24
      break
    case 'dead':
      glowColor = 0x334155
      glowA = 0.08
      break
    case 'idle':
      glowColor = EMBLEM.bronze
      glowA = 0.14
      break
    default:
      glowColor = EMBLEM.bronze
      glowA = 0.18
  }

  // Keep geometry colors; aura communicates state.
  void parts
  glow.setFillStyle(glowColor, glowA)
}
