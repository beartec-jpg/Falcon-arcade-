import Phaser from 'phaser'

export const JUICE = {
  bronze: 0xc07838,
  bronzeBright: 0xd4922a,
  bronzeDark: 0xa06030,
  quantum: 0x22d3ee,
  danger: 0xf87171,
  text: '#f1f5f9',
  gold: '#d4922a',
  cyan: '#22d3ee',
  purple: '#a78bfa',
} as const

/** Ensure shared particle textures exist on this scene. */
export function ensureJuiceTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('spark')) {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 1)
    g.fillCircle(4, 4, 4)
    g.generateTexture('spark', 8, 8)
    g.destroy()
  }
  if (!scene.textures.exists('trail-dot')) {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 1)
    g.fillCircle(6, 6, 6)
    g.generateTexture('trail-dot', 12, 12)
    g.destroy()
  }
  if (!scene.textures.exists('soft-glow')) {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 0.35)
    g.fillCircle(16, 16, 16)
    g.generateTexture('soft-glow', 32, 32)
    g.destroy()
  }
}

/** Soft bronze trail following a target. */
export function createPlayerTrail(
  scene: Phaser.Scene,
  depth = 9,
): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureJuiceTextures(scene)
  const emitter = scene.add.particles(0, 0, 'trail-dot', {
    lifespan: { min: 280, max: 520 },
    speed: { min: 4, max: 28 },
    scale: { start: 0.55, end: 0 },
    alpha: { start: 0.55, end: 0 },
    tint: [JUICE.bronzeBright, JUICE.bronze, JUICE.bronzeDark],
    frequency: 28,
    blendMode: 'ADD',
    followOffset: { x: -6, y: 0 },
    emitting: false,
    quantity: 1,
  })
  emitter.setDepth(depth)
  return emitter
}

export function startTrail(
  emitter: Phaser.GameObjects.Particles.ParticleEmitter,
  target: Phaser.GameObjects.GameObject & { x: number; y: number },
) {
  emitter.startFollow(target, -8, 0, false)
  emitter.start()
}

export function stopTrail(emitter: Phaser.GameObjects.Particles.ParticleEmitter) {
  emitter.stop()
  emitter.stopFollow()
}

/** Floating score / feedback text with pop + fade. */
export function floatScoreText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string = JUICE.gold,
  opts?: { fontSize?: string; rise?: number; duration?: number },
) {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: opts?.fontSize ?? '16px',
      color,
      fontStyle: '700',
      stroke: '#020617',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(50)
    .setScale(0.6)
    .setAlpha(0)

  scene.tweens.add({
    targets: label,
    scale: 1.15,
    alpha: 1,
    duration: 120,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: label,
        y: y - (opts?.rise ?? 42),
        alpha: 0,
        scale: 0.95,
        duration: opts?.duration ?? 520,
        ease: 'Quad.easeIn',
        onComplete: () => label.destroy(),
      })
    },
  })
  return label
}

/** Stronger death burst + scaled shake + brief slow-mo. */
export function playDeathJuice(
  scene: Phaser.Scene,
  x: number,
  y: number,
  difficulty: number,
  deathEmitter: Phaser.GameObjects.Particles.ParticleEmitter,
  onSlowMoDone?: () => void,
) {
  const shakeStr = Phaser.Math.Linear(0.012, 0.028, difficulty)
  const shakeMs = Phaser.Math.Linear(280, 420, difficulty)
  deathEmitter.setPosition(x, y)
  deathEmitter.explode(Phaser.Math.Between(36, 52))
  scene.cameras.main.shake(shakeMs, shakeStr)
  scene.cameras.main.flash(160, 192, 120, 56, false)

  // Brief slow-motion
  scene.time.timeScale = 0.28
  scene.tweens.timeScale = 0.28
  scene.time.delayedCall(320, () => {
    scene.time.timeScale = 1
    scene.tweens.timeScale = 1
    onSlowMoDone?.()
  })
}

export function createDeathEmitter(
  scene: Phaser.Scene,
  depth = 20,
): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureJuiceTextures(scene)
  const emitter = scene.add.particles(0, 0, 'spark', {
    lifespan: { min: 400, max: 900 },
    speed: { min: 90, max: 340 },
    scale: { start: 1.6, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [JUICE.bronzeBright, JUICE.bronze, JUICE.quantum, JUICE.danger],
    emitting: false,
    blendMode: 'ADD',
    quantity: 40,
    gravityY: 120,
    angle: { min: 0, max: 360 },
  })
  emitter.setDepth(depth)
  return emitter
}

export function createSparkEmitter(
  scene: Phaser.Scene,
  depth = 25,
): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureJuiceTextures(scene)
  const emitter = scene.add.particles(0, 0, 'spark', {
    lifespan: 450,
    speed: { min: 40, max: 180 },
    scale: { start: 1, end: 0 },
    alpha: { start: 0.95, end: 0 },
    tint: [JUICE.bronzeBright, JUICE.quantum],
    emitting: false,
    blendMode: 'ADD',
    quantity: 12,
  })
  emitter.setDepth(depth)
  return emitter
}

/** Soft gold flash for clean gap clears. */
export function flashCleanPass(scene: Phaser.Scene, intensity = 0.12) {
  scene.cameras.main.flash(70, 212, 146, 42, false, undefined, intensity)
}

/** Near-miss spark at gap edge. */
export function nearMissSpark(
  _scene: Phaser.Scene,
  emitter: Phaser.GameObjects.Particles.ParticleEmitter,
  x: number,
  y: number,
) {
  emitter.setPosition(x, y)
  emitter.explode(10)
}

// ── Parallax starfield ───────────────────────────────────

export type StarLayer = {
  graphics: Phaser.GameObjects.Graphics
  stars: { x: number; y: number; s: number; a: number }[]
  speed: number
}

export function createParallaxStarfield(
  scene: Phaser.Scene,
  width: number,
  height: number,
  layers = [
    { count: 28, speed: 0.18, size: [0.4, 1.1] as [number, number], alpha: [0.15, 0.4] as [number, number] },
    { count: 36, speed: 0.38, size: [0.6, 1.8] as [number, number], alpha: [0.25, 0.65] as [number, number] },
    { count: 18, speed: 0.7, size: [1.0, 2.4] as [number, number], alpha: [0.4, 0.9] as [number, number] },
  ],
): StarLayer[] {
  return layers.map((cfg, i) => {
    const graphics = scene.add.graphics().setDepth(i)
    const stars = Array.from({ length: cfg.count }, () => ({
      x: Phaser.Math.Between(0, width),
      y: Phaser.Math.Between(0, height),
      s: Phaser.Math.FloatBetween(cfg.size[0], cfg.size[1]),
      a: Phaser.Math.FloatBetween(cfg.alpha[0], cfg.alpha[1]),
    }))
    return { graphics, stars, speed: cfg.speed }
  })
}

export function updateParallaxStarfield(
  layers: StarLayer[],
  width: number,
  height: number,
  scrollSpeed: number,
  delta: number,
  axis: 'x' | 'y' = 'x',
) {
  for (const layer of layers) {
    const drift = scrollSpeed * layer.speed * (delta / 1000)
    for (const star of layer.stars) {
      if (axis === 'x') {
        star.x -= drift * (0.5 + star.s * 0.25)
        if (star.x < -4) star.x += width + 8
      } else {
        star.y += drift * (0.5 + star.s * 0.25)
        if (star.y > height + 4) star.y -= height + 8
      }
    }
    layer.graphics.clear()
    for (const star of layer.stars) {
      layer.graphics.fillStyle(0x94a3b8, star.a)
      layer.graphics.fillCircle(
        axis === 'x' ? star.x : star.x,
        star.y,
        star.s,
      )
    }
  }
}

/** Subtle scrolling ledger data-stream lines. */
export function createDataStream(
  scene: Phaser.Scene,
  depth = 1,
): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setDepth(depth).setAlpha(0.22)
}

export function drawDataStream(
  gfx: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  scroll: number,
  axis: 'horizontal' | 'vertical' = 'horizontal',
) {
  gfx.clear()
  gfx.lineStyle(1, JUICE.bronzeDark, 0.55)
  if (axis === 'horizontal') {
    for (let y = 0; y < height; y += 48) {
      const phase = (y * 0.15 + scroll) % 80
      for (let x = -40; x < width + 40; x += 80) {
        const len = 18 + ((y + x) % 20)
        gfx.lineBetween(x + phase, y, x + phase + len, y)
      }
    }
  } else {
    for (let x = 48; x < width - 48; x += 56) {
      const phase = (x * 0.12 + scroll) % 70
      for (let y = -40; y < height + 40; y += 70) {
        const len = 14 + ((x + y) % 16)
        gfx.lineBetween(x, y + phase, x, y + phase + len)
      }
    }
  }
  // side rails
  gfx.lineStyle(1, JUICE.bronze, 0.25)
  gfx.lineBetween(32, 0, 32, height)
  gfx.lineBetween(width - 32, 0, width - 32, height)
}

/** Subtle glitch/pulse tween for quantum hazards (alpha only — keeps hitboxes stable). */
export function attachQuantumPulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
) {
  scene.tweens.add({
    targets: target,
    alpha: { from: 0.72, to: 1 },
    duration: Phaser.Math.Between(280, 520),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
}

// ── Touch affordance zones ───────────────────────────────

export type TouchZonePair = {
  a: Phaser.GameObjects.Rectangle
  b: Phaser.GameObjects.Rectangle
  labelA: Phaser.GameObjects.Text
  labelB: Phaser.GameObjects.Text
  setActive: (active: boolean) => void
  pulse: (side: 'a' | 'b' | 'none') => void
}

/** Top/bottom or left/right faint zones that fade after first input. */
export function createTouchAffordances(
  scene: Phaser.Scene,
  mode: 'vertical' | 'horizontal',
): TouchZonePair {
  const { width, height } = scene.scale
  const depth = 4
  let a: Phaser.GameObjects.Rectangle
  let b: Phaser.GameObjects.Rectangle
  let labelA: Phaser.GameObjects.Text
  let labelB: Phaser.GameObjects.Text

  if (mode === 'vertical') {
    a = scene.add
      .rectangle(width / 2, height * 0.18, width, height * 0.32, JUICE.bronze, 0.06)
      .setDepth(depth)
    b = scene.add
      .rectangle(width / 2, height * 0.82, width, height * 0.32, JUICE.quantum, 0.05)
      .setDepth(depth)
    labelA = scene.add
      .text(width / 2, height * 0.14, '↑  UP', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        color: '#d4922a',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setAlpha(0.55)
    labelB = scene.add
      .text(width / 2, height * 0.86, '↓  DOWN', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        color: '#22d3ee',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setAlpha(0.55)
  } else {
    a = scene.add
      .rectangle(width * 0.18, height / 2, width * 0.32, height, JUICE.bronze, 0.06)
      .setDepth(depth)
    b = scene.add
      .rectangle(width * 0.82, height / 2, width * 0.32, height, JUICE.quantum, 0.05)
      .setDepth(depth)
    labelA = scene.add
      .text(width * 0.14, height / 2, '←', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '22px',
        color: '#d4922a',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setAlpha(0.55)
    labelB = scene.add
      .text(width * 0.86, height / 2, '→', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '22px',
        color: '#22d3ee',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setAlpha(0.55)
  }

  const all = [a, b, labelA, labelB]

  return {
    a,
    b,
    labelA,
    labelB,
    setActive: (active: boolean) => {
      for (const obj of all) {
        scene.tweens.add({
          targets: obj,
          alpha: active ? (obj instanceof Phaser.GameObjects.Text ? 0.55 : 0.06) : 0,
          duration: active ? 200 : 600,
        })
      }
    },
    pulse: (side) => {
      const target = side === 'a' ? a : side === 'b' ? b : null
      if (!target) return
      scene.tweens.add({
        targets: target,
        alpha: 0.14,
        duration: 80,
        yoyo: true,
      })
    },
  }
}

// ── How-to-play storage ──────────────────────────────────

export function hasSeenHowTo(gameSlug: string): boolean {
  try {
    return localStorage.getItem(`falcon-arcade-howto-${gameSlug}`) === '1'
  } catch {
    return false
  }
}

export function markHowToSeen(gameSlug: string) {
  try {
    localStorage.setItem(`falcon-arcade-howto-${gameSlug}`, '1')
  } catch {
    // ignore
  }
}

export type HowToOverlay = {
  container: Phaser.GameObjects.Container
  dismiss: () => void
}

export function createHowToOverlay(
  scene: Phaser.Scene,
  title: string,
  lines: string[],
  onDismiss: () => void,
): HowToOverlay {
  const { width, height } = scene.scale
  const container = scene.add.container(width / 2, height / 2).setDepth(60)
  const panel = scene.add
    .rectangle(0, 0, Math.min(440, width - 40), 260, 0x0f172a, 0.96)
    .setStrokeStyle(2, JUICE.bronze, 0.85)
  const heading = scene.add
    .text(0, -96, title, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '24px',
      color: '#f1f5f9',
      fontStyle: '700',
    })
    .setOrigin(0.5)
  const body = scene.add
    .text(0, -10, lines.join('\n'), {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
      align: 'center',
      lineSpacing: 6,
      wordWrap: { width: Math.min(380, width - 80) },
    })
    .setOrigin(0.5)
  const cta = scene.add
    .text(0, 96, 'TAP TO START', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '15px',
      color: '#d4922a',
      fontStyle: '700',
    })
    .setOrigin(0.5)

  container.add([panel, heading, body, cta])
  container.setSize(panel.width, panel.height)
  container.setInteractive(
    new Phaser.Geom.Rectangle(-panel.width / 2, -panel.height / 2, panel.width, panel.height),
    Phaser.Geom.Rectangle.Contains,
  )

  const dismiss = () => {
    scene.tweens.add({
      targets: container,
      alpha: 0,
      scale: 0.96,
      duration: 160,
      onComplete: () => {
        container.destroy(true)
        onDismiss()
      },
    })
  }
  container.on('pointerdown', dismiss)

  scene.tweens.add({
    targets: cta,
    alpha: { from: 0.55, to: 1 },
    duration: 500,
    yoyo: true,
    repeat: -1,
  })

  return { container, dismiss }
}

/** In-scene pause button (top-right). */
export function createPauseButton(
  scene: Phaser.Scene,
  onToggle: () => void,
): Phaser.GameObjects.Text {
  const { width } = scene.scale
  const btn = scene.add
    .text(width - 18, 16, 'Ⅱ', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '20px',
      color: '#f1f5f9',
      backgroundColor: '#0f172acc',
      padding: { x: 10, y: 6 },
    })
    .setOrigin(1, 0)
    .setDepth(45)
    .setInteractive({ useHandCursor: true })
  btn.on('pointerdown', () => {
    onToggle()
  })
  return btn
}
