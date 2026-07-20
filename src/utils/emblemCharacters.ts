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

// ── Falcon Flight: horizontal interceptor ────────────────

export type FlightEmblem = {
  root: Phaser.GameObjects.Container
  wingTop: Phaser.GameObjects.Triangle
  wingBot: Phaser.GameObjects.Triangle
  featherT: Phaser.GameObjects.Triangle
  featherB: Phaser.GameObjects.Triangle
  tail: Phaser.GameObjects.Triangle
  glow: Phaser.GameObjects.Arc
  ring: Phaser.GameObjects.Arc
  visor: Phaser.GameObjects.Rectangle
  energyLine: Phaser.GameObjects.Rectangle
  core: Phaser.GameObjects.Triangle
  parts: Phaser.GameObjects.Shape[]
}

export function createFlightEmblem(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 11,
): FlightEmblem {
  const root = scene.add.container(x, y).setDepth(depth)

  const ring = scene.add.circle(2, 0, 38, EMBLEM.bright, 0.05)
  const glow = scene.add.circle(0, 0, 28, EMBLEM.bronze, 0.18)

  // Layered tail feathers (streaming left)
  const tailFar = scene.add.triangle(-26, 0, 0, -11, 0, 11, -20, 0, EMBLEM.deep)
  const tail = scene.add.triangle(-20, 0, 0, -9, 0, 9, -16, 0, EMBLEM.dark)
  const tailInner = scene.add.triangle(-14, 0, 0, -5, 0, 5, -11, 0, EMBLEM.bronze)

  // Wings with secondary feather tips
  const wingBot = scene.add.triangle(-2, 12, -14, 2, 12, 4, -8, 28, EMBLEM.dark)
  const featherB = scene.add.triangle(-10, 24, 0, 6, 8, 8, -6, 34, EMBLEM.deep)
  const wingTop = scene.add.triangle(-2, -12, -14, -2, 12, -4, -8, -28, EMBLEM.bright)
  const featherT = scene.add.triangle(-10, -24, 0, -6, 8, -8, -6, -34, EMBLEM.bronze)

  // Body chevrons (depth stack)
  const bodyShadow = scene.add.triangle(1, 2, -15, -14, -15, 14, 26, 2, EMBLEM.deep)
  const body = scene.add.triangle(2, 0, -14, -13, -14, 13, 26, 0, EMBLEM.bronze)
  const core = scene.add.triangle(2, 0, -7, -7, -7, 7, 16, 0, EMBLEM.bright)

  // Energy conduit along body
  const energyLine = scene.add.rectangle(4, 0, 18, 2.5, EMBLEM.line, 0.9)
  const energyNode = scene.add.circle(14, 0, 2.4, EMBLEM.quantumHot, 0.95)

  // Head + visor
  const head = scene.add.circle(18, -2, 7, EMBLEM.bright)
  const headRim = scene.add.circle(18, -2, 7.5, EMBLEM.line, 0)
  headRim.setStrokeStyle(1.5, EMBLEM.line, 0.65)
  const visor = scene.add.rectangle(20, -2.5, 9, 4.5, EMBLEM.ink, 1)
  const visorGlow = scene.add.rectangle(20, -2.5, 7, 2.5, EMBLEM.quantum, 0.85)
  const beak = scene.add.triangle(27, 0, 0, -3.5, 0, 3.5, 13, 0, EMBLEM.line)
  const crest = scene.add.triangle(14, -10, 0, 4, 6, 2, -2, -8, EMBLEM.dark)

  root.add([
    ring,
    glow,
    featherB,
    wingBot,
    tailFar,
    tail,
    tailInner,
    featherT,
    wingTop,
    bodyShadow,
    body,
    core,
    energyLine,
    energyNode,
    crest,
    head,
    headRim,
    visor,
    visorGlow,
    beak,
  ])

  const parts: Phaser.GameObjects.Shape[] = [
    body,
    core,
    wingTop,
    wingBot,
    tail,
    head,
    energyLine,
  ]

  return {
    root,
    wingTop,
    wingBot,
    featherT,
    featherB,
    tail,
    glow,
    ring,
    visor: visorGlow,
    energyLine,
    core,
    parts,
  }
}

export function animateFlightEmblem(
  e: FlightEmblem,
  delta: number,
  t: number,
  mood: CharacterMood,
  pitch = 0,
) {
  const flap = Math.sin(t / 90) * (mood === 'play' ? 6 : 3.5)
  e.wingTop.y = -12 - flap
  e.wingBot.y = 12 + flap
  e.featherT.y = -24 - flap * 1.15
  e.featherB.y = 24 + flap * 1.15
  e.featherT.angle = -flap * 0.8
  e.featherB.angle = flap * 0.8
  e.tail.x = -20 - Math.sin(t / 140) * 1.5
  e.glow.setScale(1 + Math.sin(t / 150) * 0.1)
  e.ring.setScale(1 + Math.sin(t / 200) * 0.06)
  e.ring.setAlpha(mood === 'boost' ? 0.16 : 0.05)
  e.visor.setAlpha(0.65 + Math.sin(t / 120) * 0.3)
  e.energyLine.setAlpha(0.55 + Math.sin(t / 100) * 0.35)
  e.root.angle = Phaser.Math.Linear(e.root.angle, pitch, 0.18)
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
