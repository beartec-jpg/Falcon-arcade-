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

// ── Ledger Runner: bronze courier ────────────────────────

export type RunnerEmblem = {
  root: Phaser.GameObjects.Container
  legL: Phaser.GameObjects.Rectangle
  legR: Phaser.GameObjects.Rectangle
  arm: Phaser.GameObjects.Rectangle
  cape: Phaser.GameObjects.Triangle
  capeTip: Phaser.GameObjects.Triangle
  torso: Phaser.GameObjects.Rectangle
  head: Phaser.GameObjects.Arc
  visor: Phaser.GameObjects.Rectangle
  visorGlow: Phaser.GameObjects.Rectangle
  core: Phaser.GameObjects.Arc
  glow: Phaser.GameObjects.Arc
  parts: Phaser.GameObjects.Shape[]
}

export function createRunnerEmblem(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 11,
): RunnerEmblem {
  const root = scene.add.container(x, y).setDepth(depth)

  const glow = scene.add.circle(0, 6, 26, EMBLEM.bronze, 0.14)

  // Cape stream (left / rear)
  const cape = scene.add.triangle(-16, 2, 2, -14, 2, 16, -20, 8, EMBLEM.dark)
  const capeTip = scene.add.triangle(-24, 10, 4, -6, 4, 10, -14, 14, EMBLEM.deep)

  // Legs
  const legL = scene.add.rectangle(-6, 16, 7, 18, EMBLEM.dark)
  const legR = scene.add.rectangle(6, 16, 7, 18, EMBLEM.deep)
  const bootL = scene.add.rectangle(-6, 26, 9, 5, EMBLEM.bronze)
  const bootR = scene.add.rectangle(6, 26, 9, 5, EMBLEM.bronze)

  // Torso stack
  const torsoShadow = scene.add.rectangle(1, 2, 24, 26, EMBLEM.deep)
  const torso = scene.add.rectangle(0, 0, 22, 24, EMBLEM.bronze)
  const plate = scene.add.rectangle(0, -2, 14, 10, EMBLEM.bright, 0.55)
  const core = scene.add.circle(0, 2, 4, EMBLEM.line, 0.95)
  const coreRing = scene.add.circle(0, 2, 5.5, EMBLEM.quantum, 0)
  coreRing.setStrokeStyle(1.2, EMBLEM.quantum, 0.7)

  // Energy lines on chest plate
  const lineA = scene.add.rectangle(-4, -6, 8, 1.5, EMBLEM.line, 0.8)
  const lineB = scene.add.rectangle(4, 6, 8, 1.5, EMBLEM.line, 0.55)

  // Arm
  const arm = scene.add.rectangle(13, 0, 6, 15, EMBLEM.bright)
  const gauntlet = scene.add.rectangle(13, 8, 7, 6, EMBLEM.dark)

  // Head + visor HUD
  const head = scene.add.circle(0, -18, 10, EMBLEM.bright)
  const helm = scene.add.ellipse(0, -20, 18, 10, EMBLEM.dark, 0.35)
  const visor = scene.add.rectangle(3, -18, 12, 5, EMBLEM.ink, 1)
  const visorGlow = scene.add.rectangle(3, -18, 10, 3, EMBLEM.quantum, 0.9)
  const crest = scene.add.triangle(0, -28, -5, 4, 5, 4, 0, -6, EMBLEM.bronze)

  root.add([
    glow,
    capeTip,
    cape,
    legL,
    legR,
    bootL,
    bootR,
    torsoShadow,
    torso,
    plate,
    core,
    coreRing,
    lineA,
    lineB,
    arm,
    gauntlet,
    crest,
    head,
    helm,
    visor,
    visorGlow,
  ])

  const parts: Phaser.GameObjects.Shape[] = [torso, head, cape, arm, core, plate]

  return {
    root,
    legL,
    legR,
    arm,
    cape,
    capeTip,
    torso,
    head,
    visor,
    visorGlow,
    core,
    glow,
    parts,
  }
}

export function animateRunnerEmblem(
  e: RunnerEmblem,
  delta: number,
  t: number,
  mood: CharacterMood,
  opts: { onGround: boolean; sliding: boolean; runBob: number },
) {
  if (opts.sliding) {
    e.root.setScale(1.18, 0.52)
    e.cape.angle = 18
    e.capeTip.angle = 22
    e.visorGlow.setAlpha(1)
    applyMoodTint(e.parts, e.glow, mood === 'play' ? 'boost' : mood)
    return
  }

  e.root.setScale(1, 1)

  if (opts.onGround && mood !== 'dead') {
    const swing = Math.sin(opts.runBob / 68) * 7
    e.legL.y = 16 + swing
    e.legR.y = 16 - swing
    e.arm.angle = swing * 1.4
    e.arm.y = Math.abs(swing) * 0.1
    e.torso.y = Math.abs(swing) * 0.12
    e.head.y = -18 + Math.abs(swing) * 0.08
    e.cape.angle = -swing * 0.6 - 6
    e.capeTip.x = -24 - Math.abs(swing) * 0.35
    e.capeTip.angle = -swing * 0.9 - 4
  } else {
    e.legL.y = 10
    e.legR.y = 18
    e.cape.angle = 12
    e.capeTip.angle = 16
  }

  e.visorGlow.setAlpha(0.55 + Math.sin(t / 110) * 0.4)
  e.core.setScale(1 + Math.sin(t / 130) * 0.12)
  e.glow.setScale(1 + Math.sin(t / 160) * 0.08)
  applyMoodTint(e.parts, e.glow, mood)
  void delta
}

// ── Epoch Rise: vertical thruster falcon ─────────────────

export type RiseEmblem = {
  root: Phaser.GameObjects.Container
  wingL: Phaser.GameObjects.Triangle
  wingR: Phaser.GameObjects.Triangle
  featherL: Phaser.GameObjects.Triangle
  featherR: Phaser.GameObjects.Triangle
  thruster: Phaser.GameObjects.Rectangle
  thrusterCore: Phaser.GameObjects.Rectangle
  plume: Phaser.GameObjects.Triangle
  glow: Phaser.GameObjects.Arc
  ring: Phaser.GameObjects.Arc
  visor: Phaser.GameObjects.Rectangle
  body: Phaser.GameObjects.Triangle
  parts: Phaser.GameObjects.Shape[]
}

export function createRiseEmblem(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 13,
): RiseEmblem {
  const root = scene.add.container(x, y).setDepth(depth)

  const ring = scene.add.circle(0, 2, 36, EMBLEM.quantum, 0.06)
  const glow = scene.add.circle(0, 0, 26, EMBLEM.bronze, 0.16)

  // Thruster plume (bottom)
  const plume = scene.add.triangle(0, 28, -8, 0, 8, 0, 0, 18, EMBLEM.quantum, 0.55)
  const thruster = scene.add.rectangle(0, 18, 12, 10, EMBLEM.dark)
  const thrusterCore = scene.add.rectangle(0, 20, 6, 8, EMBLEM.quantumHot, 0.95)
  const thrusterRim = scene.add.rectangle(0, 16, 14, 3, EMBLEM.bronze)

  // Wings + feathers (horizontal span, craft points up)
  const featherL = scene.add.triangle(-22, 4, 6, -8, 6, 10, -16, 6, EMBLEM.deep)
  const featherR = scene.add.triangle(22, 4, -6, -8, -6, 10, 16, 6, EMBLEM.deep)
  const wingL = scene.add.triangle(-12, 2, 4, -10, 4, 12, -18, 4, EMBLEM.bright)
  const wingR = scene.add.triangle(12, 2, -4, -10, -4, 12, 18, 4, EMBLEM.dark)

  // Body pointing up
  const bodyShadow = scene.add.triangle(1, 2, 0, -22, -13, 16, 13, 16, EMBLEM.deep)
  const body = scene.add.triangle(0, 0, 0, -22, -12, 14, 12, 14, EMBLEM.bronze)
  const core = scene.add.triangle(0, 0, 0, -12, -6, 8, 6, 8, EMBLEM.bright)

  // Energy conduits
  const conduitL = scene.add.rectangle(-4, 2, 1.8, 14, EMBLEM.line, 0.75)
  const conduitR = scene.add.rectangle(4, 2, 1.8, 14, EMBLEM.line, 0.75)
  const node = scene.add.circle(0, 4, 3, EMBLEM.quantum, 0.9)

  // Head / visor
  const head = scene.add.circle(0, -18, 6.5, EMBLEM.bright)
  const visor = scene.add.rectangle(0, -18, 9, 4, EMBLEM.ink, 1)
  const visorGlow = scene.add.rectangle(0, -18, 7, 2.2, EMBLEM.quantum, 0.9)
  const crest = scene.add.triangle(0, -26, -4, 4, 4, 4, 0, -7, EMBLEM.line)

  root.add([
    ring,
    glow,
    plume,
    thruster,
    thrusterCore,
    thrusterRim,
    featherL,
    featherR,
    wingL,
    wingR,
    bodyShadow,
    body,
    core,
    conduitL,
    conduitR,
    node,
    crest,
    head,
    visor,
    visorGlow,
  ])

  const parts: Phaser.GameObjects.Shape[] = [
    body,
    core,
    wingL,
    wingR,
    head,
    thruster,
    thrusterCore,
  ]

  return {
    root,
    wingL,
    wingR,
    featherL,
    featherR,
    thruster,
    thrusterCore,
    plume,
    glow,
    ring,
    visor: visorGlow,
    body,
    parts,
  }
}

export function animateRiseEmblem(
  e: RiseEmblem,
  delta: number,
  t: number,
  mood: CharacterMood,
  bank = 0,
) {
  const flap = Math.sin(t / 95) * (mood === 'boost' ? 7 : 4.5)
  e.wingL.x = -12 - flap * 0.35
  e.wingR.x = 12 + flap * 0.35
  e.featherL.x = -22 - flap * 0.5
  e.featherR.x = 22 + flap * 0.5
  e.wingL.angle = -flap * 0.5
  e.wingR.angle = flap * 0.5

  // Thruster pulse
  const thrust = mood === 'boost' ? 1.35 : mood === 'play' ? 1 : 0.75
  e.plume.setScale(0.85 + Math.sin(t / 70) * 0.25 * thrust, thrust)
  e.plume.setAlpha(0.35 + Math.sin(t / 80) * 0.25 * thrust)
  e.thrusterCore.setAlpha(0.7 + Math.sin(t / 60) * 0.3)
  e.visor.setAlpha(0.55 + Math.sin(t / 110) * 0.4)

  e.glow.setScale(1 + Math.sin(t / 140) * 0.1)
  e.ring.setScale(1 + Math.sin(t / 180) * 0.08)
  e.ring.setAlpha(mood === 'shield' ? 0.22 : mood === 'boost' ? 0.14 : 0.06)

  e.root.angle = Phaser.Math.Linear(e.root.angle, bank, 0.16)
  applyMoodTint(e.parts, e.glow, mood)

  // Shield / boost special ring tint
  if (mood === 'shield') {
    e.ring.setFillStyle(EMBLEM.shield, 0.2)
    e.glow.setFillStyle(EMBLEM.shield, 0.22)
  } else if (mood === 'boost') {
    e.ring.setFillStyle(EMBLEM.bright, 0.14)
    e.glow.setFillStyle(EMBLEM.bright, 0.2)
  } else if (mood === 'danger') {
    e.ring.setFillStyle(EMBLEM.danger, 0.12)
    e.glow.setFillStyle(EMBLEM.danger, 0.18)
  } else {
    e.ring.setFillStyle(EMBLEM.quantum, mood === 'play' ? 0.08 : 0.05)
    e.glow.setFillStyle(EMBLEM.bronze, 0.16)
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
