import Phaser from 'phaser'
import {
  EPOCH_COLORS,
  EPOCH_RISE,
  EPOCH_RISE_REWARD_THRESHOLD,
  type EpochRiseBridge,
  type EpochRiseGameState,
} from './epochRiseConfig'

type EntityKind =
  | 'ledger'
  | 'interference'
  | 'orb'
  | 'cluster-orb'
  | 'shield'
  | 'boost-zone'
  | 'mover'

type EntityMeta = {
  kind: EntityKind
  scored?: boolean
  hit?: boolean
  vx?: number
}

/**
 * Epoch Rise — vertical energy scroller.
 * Falcon rises continuously; steer left/right, manage energy, collect orbs.
 */
export class EpochRiseScene extends Phaser.Scene {
  private state: EpochRiseGameState = 'ready'
  private score = 0
  private energy: number = EPOCH_RISE.maxEnergy
  private heightAccumulator = 0
  private riseSpeed: number = EPOCH_RISE.baseRiseSpeed
  private difficulty = 0
  private nextSpawnAt = 0
  private elapsedPlayMs = 0

  private falcon!: Phaser.Physics.Arcade.Image
  private falconVisual!: Phaser.GameObjects.Container
  private entities!: Phaser.Physics.Arcade.Group

  private shieldUntil = 0
  private boostZoneUntil = 0
  private dashUntil = 0
  private dashDir = 0
  private invulnUntil = 0

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keyLeft!: Phaser.Input.Keyboard.Key
  private keyRight!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private keyShift!: Phaser.Input.Keyboard.Key
  private keyW!: Phaser.Input.Keyboard.Key

  private pointerDir = 0

  private stars!: Phaser.GameObjects.Graphics
  private starOffsets: { x: number; y: number; s: number; a: number }[] = []
  private laneGfx!: Phaser.GameObjects.Graphics
  private laneScroll = 0

  private hudScore!: Phaser.GameObjects.Text
  private hudHint!: Phaser.GameObjects.Text
  private energyFill!: Phaser.GameObjects.Rectangle
  private energyLabel!: Phaser.GameObjects.Text
  private statusPills!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Container
  private collectEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private hitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private wingFlap = 0

  constructor() {
    super('EpochRiseScene')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(EPOCH_COLORS.bgHex)
    this.physics.world.gravity.y = 0
    this.physics.world.setBounds(0, 0, width, height)

    this.createStarfield(width, height)
    this.laneGfx = this.add.graphics().setDepth(1)
    this.createTextures()

    this.entities = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    })

    this.falconVisual = this.createFalconVisual()
    this.falcon = this.physics.add.image(
      width / 2,
      EPOCH_RISE.playerY,
      'falcon-hitbox',
    )
    this.falcon.setVisible(false)
    this.falcon.setCircle(EPOCH_RISE.playerRadius)
    this.falcon.setCollideWorldBounds(true)
    this.falcon.setDepth(12)
    this.falcon.setGravity(0, 0)

    this.physics.add.overlap(
      this.falcon,
      this.entities,
      (_f, ent) => this.handleEntityOverlap(ent as Phaser.Physics.Arcade.Image),
      undefined,
      this,
    )

    this.setupInput()
    this.createHud(width, height)
    this.createParticles()
    this.resetRun()
    this.showOverlay('ready')
    this.emitState('ready')
    this.emitScore(0)
    this.emitEnergy()
  }

  update(_time: number, delta: number) {
    this.scrollStarfield(delta)
    this.drawLanes(delta)
    this.updateFalconVisual(delta)

    if (this.state === 'ready') {
      this.idleHover(delta)
      if (this.wantsStart()) {
        this.beginRun()
      }
      return
    }

    if (this.state === 'gameover') {
      if (this.wantsStart()) {
        this.resetRun()
        this.beginRun()
      }
      return
    }

    // playing
    this.elapsedPlayMs += delta
    this.difficulty = Phaser.Math.Clamp(
      this.elapsedPlayMs / (EPOCH_RISE.difficultyRampSeconds * 1000),
      0,
      1,
    )

    let rise = Phaser.Math.Linear(
      EPOCH_RISE.baseRiseSpeed,
      EPOCH_RISE.maxRiseSpeed,
      this.difficulty,
    )
    if (this.time.now < this.boostZoneUntil) {
      rise *= 1.45
    }
    this.riseSpeed = rise

    this.applyLateralMovement()
    this.applyPassiveEnergyDrain(delta)
    this.advanceHeightScore(delta)
    this.spawnEntitiesIfNeeded()
    this.updateEntities(delta)
    this.cullEntities()
    this.refreshHudStatus()
    this.refreshEnergyBar()

    if (this.energy <= 0) {
      this.energy = 0
      this.handleGameOver()
    }
  }

  // ── setup ──────────────────────────────────────────────

  private createTextures() {
    if (!this.textures.exists('falcon-hitbox')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 1)
      g.fillCircle(16, 16, 16)
      g.generateTexture('falcon-hitbox', 32, 32)
      g.destroy()
    }
    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 1)
      g.fillCircle(4, 4, 4)
      g.generateTexture('spark', 8, 8)
      g.destroy()
    }
    if (!this.textures.exists('ledger-block')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 72
      const h = 28
      g.fillStyle(EPOCH_COLORS.ledgerFace, 1)
      g.fillRoundedRect(0, 0, w, h, 5)
      g.lineStyle(2, EPOCH_COLORS.danger, 0.85)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 5)
      g.lineStyle(1, EPOCH_COLORS.bronzeDark, 0.5)
      g.lineBetween(10, 10, w - 10, 10)
      g.lineBetween(10, 18, w - 10, 18)
      g.generateTexture('ledger-block', w, h)
      g.destroy()
    }
    if (!this.textures.exists('interference')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 100
      const h = 56
      g.fillStyle(EPOCH_COLORS.quantumDim, 0.35)
      g.fillRoundedRect(0, 0, w, h, 8)
      g.lineStyle(2, EPOCH_COLORS.quantum, 0.7)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 8)
      g.lineStyle(1, EPOCH_COLORS.quantum, 0.4)
      for (let i = -h; i < w + h; i += 10) {
        g.lineBetween(i, 0, i + h, h)
      }
      g.generateTexture('interference', w, h)
      g.destroy()
    }
    if (!this.textures.exists('orb')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 22
      g.fillStyle(EPOCH_COLORS.quantum, 0.25)
      g.fillCircle(s / 2, s / 2, s / 2)
      g.fillStyle(EPOCH_COLORS.quantumHot, 0.9)
      g.fillCircle(s / 2, s / 2, 6)
      g.lineStyle(2, EPOCH_COLORS.bronzeBright, 0.8)
      g.strokeCircle(s / 2, s / 2, s / 2 - 1)
      g.generateTexture('orb', s, s)
      g.destroy()
    }
    if (!this.textures.exists('orb-cluster')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 28
      g.fillStyle(EPOCH_COLORS.bronze, 0.3)
      g.fillCircle(s / 2, s / 2, s / 2)
      g.fillStyle(EPOCH_COLORS.bronzeBright, 0.95)
      g.fillCircle(s / 2, s / 2, 7)
      g.lineStyle(2, EPOCH_COLORS.quantumHot, 0.9)
      g.strokeCircle(s / 2, s / 2, s / 2 - 1)
      g.generateTexture('orb-cluster', s, s)
      g.destroy()
    }
    if (!this.textures.exists('shield-pickup')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 26
      g.lineStyle(3, EPOCH_COLORS.shield, 0.95)
      g.strokeCircle(s / 2, s / 2, s / 2 - 2)
      g.fillStyle(EPOCH_COLORS.shield, 0.25)
      g.fillCircle(s / 2, s / 2, 6)
      g.generateTexture('shield-pickup', s, s)
      g.destroy()
    }
    if (!this.textures.exists('boost-zone')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 90
      const h = 70
      g.fillStyle(EPOCH_COLORS.boost, 0.18)
      g.fillRoundedRect(0, 0, w, h, 10)
      g.lineStyle(2, EPOCH_COLORS.bronzeBright, 0.85)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 10)
      // up chevrons
      g.fillStyle(EPOCH_COLORS.bronzeBright, 0.8)
      g.fillTriangle(w / 2, 14, w / 2 - 12, 30, w / 2 + 12, 30)
      g.fillTriangle(w / 2, 32, w / 2 - 12, 48, w / 2 + 12, 48)
      g.generateTexture('boost-zone', w, h)
      g.destroy()
    }
    if (!this.textures.exists('mover')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 54
      const h = 22
      g.fillStyle(EPOCH_COLORS.danger, 0.85)
      g.fillRoundedRect(0, 0, w, h, 4)
      g.lineStyle(2, EPOCH_COLORS.bronze, 0.9)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 4)
      g.generateTexture('mover', w, h)
      g.destroy()
    }
  }

  private createFalconVisual() {
    const c = this.add.container(this.scale.width / 2, EPOCH_RISE.playerY)
    c.setDepth(13)

    const glow = this.add.circle(0, 0, 24, EPOCH_COLORS.bronze, 0.14)
    // Pointing up for vertical rise
    const body = this.add.triangle(0, 0, 0, -20, -12, 14, 12, 14, EPOCH_COLORS.bronze)
    const wingL = this.add.triangle(-10, 2, 0, -6, -20, 8, 2, 6, EPOCH_COLORS.bronzeBright)
    const wingR = this.add.triangle(10, 2, 0, -6, 20, 8, -2, 6, EPOCH_COLORS.bronzeDark)
    const head = this.add.circle(0, -16, 5, EPOCH_COLORS.bronzeBright)
    const engine = this.add.rectangle(0, 16, 8, 6, EPOCH_COLORS.quantum)

    c.add([glow, wingL, wingR, body, head, engine])
    c.setData('wingL', wingL)
    c.setData('wingR', wingR)
    c.setData('glow', glow)
    c.setData('engine', engine)
    return c
  }

  private createStarfield(width: number, height: number) {
    this.stars = this.add.graphics().setDepth(0)
    this.starOffsets = []
    for (let i = 0; i < 50; i += 1) {
      this.starOffsets.push({
        x: Phaser.Math.Between(0, width),
        y: Phaser.Math.Between(0, height),
        s: Phaser.Math.FloatBetween(0.5, 2.2),
        a: Phaser.Math.FloatBetween(0.2, 0.8),
      })
    }
    this.drawStars()
  }

  private drawStars() {
    const { width, height } = this.scale
    this.stars.clear()
    for (const star of this.starOffsets) {
      this.stars.fillStyle(EPOCH_COLORS.star, star.a)
      this.stars.fillCircle(
        ((star.x % width) + width) % width,
        ((star.y % height) + height) % height,
        star.s,
      )
    }
  }

  private scrollStarfield(delta: number) {
    const drift =
      (this.state === 'playing' ? this.riseSpeed : 40) * (delta / 1000) * 0.55
    for (const star of this.starOffsets) {
      star.y += drift * (0.4 + star.s * 0.25)
    }
    this.drawStars()
  }

  private drawLanes(delta: number) {
    if (this.state === 'playing') {
      this.laneScroll =
        (this.laneScroll + this.riseSpeed * (delta / 1000) * 0.8) % 60
    }
    const { width, height } = this.scale
    this.laneGfx.clear()
    this.laneGfx.lineStyle(1, EPOCH_COLORS.bronzeDark, 0.2)
    for (let y = -60; y < height + 60; y += 60) {
      const py = y + this.laneScroll
      this.laneGfx.lineBetween(40, py, width - 40, py)
    }
    // Side rails
    this.laneGfx.lineStyle(2, EPOCH_COLORS.bronze, 0.25)
    this.laneGfx.lineBetween(36, 0, 36, height)
    this.laneGfx.lineBetween(width - 36, 0, width - 36, height)
  }

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      this.keyLeft = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)
      this.keyRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.state === 'ready') {
        this.beginRun()
        return
      }
      if (this.state === 'gameover') {
        this.resetRun()
        this.beginRun()
        return
      }

      const mid = this.scale.width / 2
      this.pointerDir = pointer.x < mid ? -1 : 1
      // Upper third = dash
      if (pointer.y < this.scale.height * 0.28) {
        this.tryDash(this.pointerDir)
      }
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || this.state !== 'playing') return
      this.pointerDir = pointer.x < this.scale.width / 2 ? -1 : 1
    })
    this.input.on('pointerup', () => {
      this.pointerDir = 0
    })
  }

  private createHud(width: number, height: number) {
    this.hudScore = this.add
      .text(20, 16, 'SCORE  0', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '22px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setDepth(40)
      .setScrollFactor(0)

    this.add
      .text(20, 44, `THRESHOLD  ${EPOCH_RISE_REWARD_THRESHOLD}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
        color: '#94a3b8',
        fontStyle: '600',
      })
      .setDepth(40)

    // Energy bar
    const barX = width / 2
    const barY = 28
    const barW = 220
    const barH = 14
    this.add
      .rectangle(barX, barY, barW + 6, barH + 6, EPOCH_COLORS.panel, 0.95)
      .setStrokeStyle(1, EPOCH_COLORS.bronze, 0.5)
      .setDepth(40)
    this.add
      .rectangle(barX, barY, barW, barH, EPOCH_COLORS.border, 1)
      .setDepth(41)
    this.energyFill = this.add
      .rectangle(barX - barW / 2, barY, barW, barH, EPOCH_COLORS.energy, 1)
      .setOrigin(0, 0.5)
      .setDepth(42)
    this.energyLabel = this.add
      .text(barX, barY, 'ENERGY', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '10px',
        color: '#020617',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(43)

    this.statusPills = this.add
      .text(width - 20, 20, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        color: '#d4922a',
        fontStyle: '700',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setDepth(40)

    this.hudHint = this.add
      .text(
        width / 2,
        height - 28,
        '← → / A D steer  ·  SPACE / SHIFT dash  ·  collect orbs, avoid ledgers',
        {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '13px',
          color: '#94a3b8',
        },
      )
      .setOrigin(0.5)
      .setDepth(40)
  }

  private createParticles() {
    this.collectEmitter = this.add.particles(0, 0, 'spark', {
      lifespan: 500,
      speed: { min: 40, max: 160 },
      scale: { start: 1, end: 0 },
      tint: [EPOCH_COLORS.quantumHot, EPOCH_COLORS.bronzeBright],
      emitting: false,
      blendMode: 'ADD',
      quantity: 12,
    })
    this.collectEmitter.setDepth(30)

    this.hitEmitter = this.add.particles(0, 0, 'spark', {
      lifespan: 600,
      speed: { min: 80, max: 240 },
      scale: { start: 1.2, end: 0 },
      tint: [EPOCH_COLORS.danger, EPOCH_COLORS.bronze],
      emitting: false,
      blendMode: 'ADD',
      quantity: 18,
    })
    this.hitEmitter.setDepth(30)
  }

  private createOverlay() {
    if (this.overlay) {
      this.overlay.destroy(true)
    }
    const { width, height } = this.scale
    const container = this.add.container(width / 2, height / 2).setDepth(50)
    const panel = this.add
      .rectangle(0, 0, 460, 230, EPOCH_COLORS.panel, 0.94)
      .setStrokeStyle(2, EPOCH_COLORS.bronze, 0.7)
    const title = this.add
      .text(0, -68, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '30px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setOrigin(0.5)
    const body = this.add
      .text(0, -4, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '15px',
        color: '#94a3b8',
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5)
    const cta = this.add
      .text(0, 74, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        color: '#d4922a',
        fontStyle: '700',
      })
      .setOrigin(0.5)

    container.add([panel, title, body, cta])
    container.setData('title', title)
    container.setData('body', body)
    container.setData('cta', cta)
    container.setSize(460, 230)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-230, -115, 460, 230),
      Phaser.Geom.Rectangle.Contains,
    )
    container.on('pointerdown', () => {
      if (this.state === 'ready') this.beginRun()
      else if (this.state === 'gameover') {
        this.resetRun()
        this.beginRun()
      }
    })
    this.overlay = container
  }

  private showOverlay(mode: 'ready' | 'gameover') {
    this.createOverlay()
    const title = this.overlay.getData('title') as Phaser.GameObjects.Text
    const body = this.overlay.getData('body') as Phaser.GameObjects.Text
    const cta = this.overlay.getData('cta') as Phaser.GameObjects.Text

    if (mode === 'ready') {
      title.setText('Epoch Rise')
      body.setText(
        'Rise through the epoch. Steer left and right, keep your energy alive, grab quantum orbs, and dodge bad ledgers. Riskier clusters pay more.',
      )
      cta.setText('TAP / SPACE TO ASCEND')
    } else {
      title.setText('Energy Depleted')
      body.setText(
        `Final score  ${this.score}\nClear ${EPOCH_RISE_REWARD_THRESHOLD} points to unlock the Game Faucet claim.`,
      )
      cta.setText('TAP / SPACE TO RESTART')
    }
    this.overlay.setVisible(true)
    this.hudHint.setText(
      mode === 'ready'
        ? '← → / A D steer  ·  SPACE / SHIFT dash  ·  collect orbs, avoid ledgers'
        : 'SPACE or tap to restart',
    )
  }

  private hideOverlay() {
    if (this.overlay) this.overlay.setVisible(false)
  }

  // ── lifecycle ──────────────────────────────────────────

  private resetRun() {
    this.state = 'ready'
    this.score = 0
    this.energy = EPOCH_RISE.maxEnergy
    this.heightAccumulator = 0
    this.riseSpeed = EPOCH_RISE.baseRiseSpeed
    this.difficulty = 0
    this.elapsedPlayMs = 0
    this.nextSpawnAt = 0
    this.shieldUntil = 0
    this.boostZoneUntil = 0
    this.dashUntil = 0
    this.invulnUntil = 0

    this.entities.clear(true, true)
    this.falcon.setPosition(this.scale.width / 2, EPOCH_RISE.playerY)
    this.falcon.setVelocity(0, 0)
    this.falconVisual.setAlpha(1)
    this.falconVisual.setAngle(0)
    this.hudScore.setText('SCORE  0')
    this.hudScore.setColor('#f1f5f9')
    this.refreshEnergyBar()
    this.refreshHudStatus()
    this.emitScore(0)
    this.emitEnergy()
  }

  private beginRun() {
    this.state = 'playing'
    this.hideOverlay()
    this.nextSpawnAt = this.time.now + 600
    this.hudHint.setText('Hold energy · snag orbs · dash through tight gaps')
    this.emitState('playing')
  }

  private handleGameOver() {
    if (this.state !== 'playing') return
    this.state = 'gameover'
    this.falcon.setVelocity(0, 0)

    this.hitEmitter.setPosition(this.falcon.x, this.falcon.y)
    this.hitEmitter.explode(28)
    this.cameras.main.shake(320, 0.014)
    this.cameras.main.flash(150, 248, 113, 113, false)

    this.tweens.add({
      targets: this.falconVisual,
      alpha: 0.25,
      angle: 25,
      duration: 280,
      ease: 'Quad.easeOut',
    })

    this.showOverlay('gameover')
    this.emitState('gameover')
    this.emitScore(this.score)
    this.emitEnergy()
  }

  // ── movement ───────────────────────────────────────────

  private lateralIntent(): number {
    let dir = 0
    if (
      this.cursors?.left.isDown ||
      this.keyA?.isDown ||
      this.keyLeft?.isDown
    ) {
      dir -= 1
    }
    if (
      this.cursors?.right.isDown ||
      this.keyD?.isDown ||
      this.keyRight?.isDown
    ) {
      dir += 1
    }
    if (this.pointerDir !== 0) dir = this.pointerDir
    return Phaser.Math.Clamp(dir, -1, 1)
  }

  private applyLateralMovement() {
    if (this.state === 'playing') {
      const dashPressed =
        (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) ||
        (this.keyShift && Phaser.Input.Keyboard.JustDown(this.keyShift)) ||
        (this.keyW && Phaser.Input.Keyboard.JustDown(this.keyW))

      if (dashPressed) {
        const dir = this.lateralIntent()
        this.tryDash(dir === 0 ? 1 : dir)
      }
    }

    const dashing = this.time.now < this.dashUntil
    const speed = dashing ? EPOCH_RISE.boostSpeed : EPOCH_RISE.lateralSpeed
    const intent = dashing ? this.dashDir : this.lateralIntent()

    this.falcon.setVelocityX(intent * speed)
    this.falcon.y = EPOCH_RISE.playerY
    this.falcon.setVelocityY(0)

    // Soft side padding
    const pad = 48
    if (this.falcon.x < pad) {
      this.falcon.x = pad
    }
    if (this.falcon.x > this.scale.width - pad) {
      this.falcon.x = this.scale.width - pad
    }
  }

  private tryDash(dir: number) {
    if (this.state !== 'playing') return
    if (this.time.now < this.dashUntil) return
    if (this.energy < EPOCH_RISE.boostEnergyCost) return

    this.changeEnergy(-EPOCH_RISE.boostEnergyCost)
    this.dashDir = dir === 0 ? 1 : dir
    this.dashUntil = this.time.now + EPOCH_RISE.boostDurationMs
    this.floatText(this.falcon.x, this.falcon.y - 30, 'DASH', '#d4922a')
  }

  private wantsStart(): boolean {
    return Boolean(
      this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace),
    )
  }

  private idleHover(delta: number) {
    this.wingFlap += delta
    const bob = Math.sin(this.wingFlap / 280) * 6
    this.falcon.y = EPOCH_RISE.playerY + bob
    this.falconVisual.x = this.falcon.x
    this.falconVisual.y = this.falcon.y
  }

  private updateFalconVisual(delta: number) {
    if (!this.falconVisual || !this.falcon) return
    this.falconVisual.x = this.falcon.x
    this.falconVisual.y = this.falcon.y

    const wingL = this.falconVisual.getData('wingL') as Phaser.GameObjects.Triangle
    const wingR = this.falconVisual.getData('wingR') as Phaser.GameObjects.Triangle
    const glow = this.falconVisual.getData('glow') as Phaser.GameObjects.Arc
    const engine = this.falconVisual.getData('engine') as Phaser.GameObjects.Rectangle

    this.wingFlap += delta * (this.state === 'playing' ? 1.4 : 0.8)
    const flap = Math.sin(this.wingFlap / 100) * 5
    wingL.x = -10 - flap * 0.3
    wingR.x = 10 + flap * 0.3

    const vx = this.falcon.body?.velocity.x ?? 0
    this.falconVisual.angle = Phaser.Math.Linear(
      this.falconVisual.angle,
      Phaser.Math.Clamp(vx / 20, -18, 18),
      0.18,
    )

    const shielded = this.time.now < this.shieldUntil
    glow.setFillStyle(
      shielded ? EPOCH_COLORS.shield : EPOCH_COLORS.bronze,
      shielded ? 0.28 : 0.14,
    )
    engine.setFillStyle(
      this.time.now < this.boostZoneUntil
        ? EPOCH_COLORS.bronzeBright
        : EPOCH_COLORS.quantum,
    )
  }

  // ── energy & score ─────────────────────────────────────

  private applyPassiveEnergyDrain(delta: number) {
    if (this.time.now < this.shieldUntil) return

    const drain = Phaser.Math.Linear(
      EPOCH_RISE.baseDrainPerSecond,
      EPOCH_RISE.maxDrainPerSecond,
      this.difficulty,
    )
    this.changeEnergy(-(drain * delta) / 1000)
  }

  private changeEnergy(delta: number) {
    const prev = this.energy
    this.energy = Phaser.Math.Clamp(
      this.energy + delta,
      0,
      EPOCH_RISE.maxEnergy,
    )
    if (this.energy !== prev) {
      this.emitEnergy()
    }
  }

  private advanceHeightScore(delta: number) {
    const speedFactor = this.riseSpeed / EPOCH_RISE.baseRiseSpeed
    let rate = EPOCH_RISE.heightPointsPerSecond * speedFactor
    if (this.energy >= EPOCH_RISE.efficiencyBonusThreshold) {
      rate += EPOCH_RISE.efficiencyPointsPerSecond
    }
    this.heightAccumulator += (rate * delta) / 1000
    while (this.heightAccumulator >= 1) {
      this.heightAccumulator -= 1
      this.addScore(1)
    }
  }

  private addScore(amount: number) {
    const prev = this.score
    this.score += amount
    if (this.score !== prev) {
      this.hudScore.setText(`SCORE  ${this.score}`)
      if (
        this.score >= EPOCH_RISE_REWARD_THRESHOLD &&
        prev < EPOCH_RISE_REWARD_THRESHOLD
      ) {
        this.hudScore.setColor('#d4922a')
        this.cameras.main.flash(80, 208, 146, 42, false)
      }
      this.emitScore(this.score)
    }
  }

  private refreshEnergyBar() {
    const pct = this.energy / EPOCH_RISE.maxEnergy
    const barW = 220
    this.energyFill.width = Math.max(2, barW * pct)
    this.energyFill.setFillStyle(
      pct < 0.28 ? EPOCH_COLORS.energyLow : EPOCH_COLORS.energy,
    )
    this.energyLabel.setText(`ENERGY  ${Math.ceil(this.energy)}`)
    this.energyLabel.setColor(pct < 0.28 ? '#f1f5f9' : '#020617')
  }

  private refreshHudStatus() {
    const tags: string[] = []
    if (this.time.now < this.shieldUntil) tags.push('SHIELD')
    if (this.time.now < this.boostZoneUntil) tags.push('BOOST')
    if (this.time.now < this.dashUntil) tags.push('DASH')
    this.statusPills.setText(tags.join('  ·  '))
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color,
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(35)
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 600,
      onComplete: () => t.destroy(),
    })
  }

  // ── entities ───────────────────────────────────────────

  private spawnEntitiesIfNeeded() {
    if (this.time.now < this.nextSpawnAt) return

    const interval = Phaser.Math.Linear(
      EPOCH_RISE.spawnMaxMs,
      EPOCH_RISE.spawnMinMs,
      this.difficulty,
    )

    const roll = Math.random()
    if (roll < 0.28) {
      this.spawnLedger()
    } else if (roll < 0.42) {
      this.spawnInterference()
    } else if (roll < 0.55) {
      this.spawnMover()
    } else if (roll < 0.78) {
      this.spawnOrb(false)
    } else if (roll < 0.9) {
      this.spawnOrbCluster()
    } else if (roll < 0.96) {
      this.spawnShield()
    } else {
      this.spawnBoostZone()
    }

    // Extra hazard pressure at high difficulty
    if (this.difficulty > 0.45 && Math.random() < 0.35) {
      this.time.delayedCall(180, () => {
        if (this.state === 'playing') this.spawnLedger()
      })
    }

    this.nextSpawnAt =
      this.time.now + interval * Phaser.Math.FloatBetween(0.85, 1.12)
  }

  private spawnAtTop(texture: string, w: number, h: number, meta: EntityMeta) {
    const pad = 60
    const x = Phaser.Math.Between(pad, this.scale.width - pad)
    const y = -40
    const obj = this.entities.create(x, y, texture) as Phaser.Physics.Arcade.Image
    obj.setDisplaySize(w, h)
    obj.refreshBody()
    const body = obj.body as Phaser.Physics.Arcade.Body
    body.setSize(w * 0.88, h * 0.88)
    obj.setImmovable(true)
    obj.setDepth(8)
    obj.setData('meta', meta)
    return obj
  }

  private spawnLedger() {
    const w = Phaser.Math.Between(70, 140)
    this.spawnAtTop('ledger-block', w, 26, { kind: 'ledger', hit: false })
  }

  private spawnInterference() {
    const w = Phaser.Math.Between(90, 160)
    this.spawnAtTop('interference', w, 52, { kind: 'interference' })
  }

  private spawnMover() {
    const obj = this.spawnAtTop('mover', 54, 22, {
      kind: 'mover',
      hit: false,
      vx: Phaser.Math.Between(80, 160) * (Math.random() < 0.5 ? -1 : 1),
    })
    return obj
  }

  private spawnOrb(cluster: boolean) {
    const key = cluster ? 'orb-cluster' : 'orb'
    const size = cluster ? 28 : 22
    this.spawnAtTop(key, size, size, {
      kind: cluster ? 'cluster-orb' : 'orb',
      scored: false,
    })
  }

  private spawnOrbCluster() {
    // Risky pack: several high-value orbs near a ledger
    const cx = Phaser.Math.Between(120, this.scale.width - 120)
    for (let i = 0; i < 3; i += 1) {
      const obj = this.entities.create(
        cx + (i - 1) * 34,
        -50 - i * 12,
        'orb-cluster',
      ) as Phaser.Physics.Arcade.Image
      obj.setDisplaySize(26, 26)
      obj.refreshBody()
      obj.setImmovable(true)
      obj.setDepth(8)
      obj.setData('meta', {
        kind: 'cluster-orb',
        scored: false,
      } satisfies EntityMeta)
    }
    // Nearby hazard
    const trap = this.entities.create(cx, -110, 'ledger-block') as Phaser.Physics.Arcade.Image
    trap.setDisplaySize(100, 26)
    trap.refreshBody()
    trap.setImmovable(true)
    trap.setDepth(8)
    trap.setData('meta', { kind: 'ledger', hit: false } satisfies EntityMeta)
  }

  private spawnShield() {
    this.spawnAtTop('shield-pickup', 26, 26, { kind: 'shield', scored: false })
  }

  private spawnBoostZone() {
    this.spawnAtTop('boost-zone', 90, 70, { kind: 'boost-zone', scored: false })
  }

  private updateEntities(delta: number) {
    const dy = this.riseSpeed * (delta / 1000)
    const children = this.entities.getChildren() as Phaser.Physics.Arcade.Image[]

    for (const ent of children) {
      ent.y += dy
      const meta = ent.getData('meta') as EntityMeta | undefined
      if (meta?.kind === 'mover' && meta.vx) {
        ent.x += meta.vx * (delta / 1000)
        if (ent.x < 50 || ent.x > this.scale.width - 50) {
          meta.vx *= -1
        }
      }

      // Continuous interference drain while overlapping — handled in overlap
      // Pulse orbs
      if (meta?.kind === 'orb' || meta?.kind === 'cluster-orb') {
        ent.setScale(1 + Math.sin(this.time.now / 200 + ent.x) * 0.06)
      }

      const body = ent.body as Phaser.Physics.Arcade.Body | null
      if (body) body.updateFromGameObject()
    }
  }

  private cullEntities() {
    const children = this.entities.getChildren() as Phaser.Physics.Arcade.Image[]
    for (const ent of children) {
      if (ent.y > this.scale.height + 80) {
        ent.destroy()
      }
    }
  }

  private handleEntityOverlap(ent: Phaser.Physics.Arcade.Image) {
    if (this.state !== 'playing' || !ent.active) return
    const meta = ent.getData('meta') as EntityMeta | undefined
    if (!meta) return

    switch (meta.kind) {
      case 'orb':
        if (meta.scored) return
        meta.scored = true
        this.changeEnergy(EPOCH_RISE.orbEnergy)
        this.addScore(EPOCH_RISE.orbScore)
        this.collectEmitter.setPosition(ent.x, ent.y)
        this.collectEmitter.explode(10)
        this.floatText(ent.x, ent.y, `+${EPOCH_RISE.orbScore}`, '#22d3ee')
        ent.destroy()
        break

      case 'cluster-orb':
        if (meta.scored) return
        meta.scored = true
        this.changeEnergy(EPOCH_RISE.clusterOrbEnergy)
        this.addScore(EPOCH_RISE.clusterOrbScore)
        this.collectEmitter.setPosition(ent.x, ent.y)
        this.collectEmitter.explode(14)
        this.floatText(ent.x, ent.y, `+${EPOCH_RISE.clusterOrbScore}`, '#d4922a')
        ent.destroy()
        break

      case 'shield':
        if (meta.scored) return
        meta.scored = true
        this.shieldUntil = this.time.now + EPOCH_RISE.shieldDurationMs
        this.floatText(ent.x, ent.y, 'SHIELD', '#a78bfa')
        this.collectEmitter.setPosition(ent.x, ent.y)
        this.collectEmitter.explode(12)
        ent.destroy()
        break

      case 'boost-zone':
        if (!meta.scored) {
          meta.scored = true
          this.boostZoneUntil = this.time.now + EPOCH_RISE.boostZoneDurationMs
          this.floatText(ent.x, ent.y, 'RISE BOOST', '#d4922a')
          this.addScore(5)
        }
        break

      case 'ledger':
      case 'mover':
        if (meta.hit) return
        if (this.time.now < this.shieldUntil || this.time.now < this.invulnUntil) {
          return
        }
        meta.hit = true
        this.changeEnergy(-EPOCH_RISE.ledgerHitDrain)
        this.invulnUntil = this.time.now + 450
        this.hitEmitter.setPosition(this.falcon.x, this.falcon.y)
        this.hitEmitter.explode(14)
        this.cameras.main.shake(120, 0.008)
        this.floatText(
          this.falcon.x,
          this.falcon.y - 24,
          `-${EPOCH_RISE.ledgerHitDrain} EN`,
          '#f87171',
        )
        this.tweens.add({
          targets: this.falconVisual,
          alpha: 0.4,
          duration: 80,
          yoyo: true,
          repeat: 2,
        })
        break

      case 'interference':
        if (this.time.now < this.shieldUntil) return
        this.changeEnergy(
          -(EPOCH_RISE.interferenceDrainPerSecond * this.game.loop.delta) / 1000,
        )
        break

      default:
        break
    }
  }

  // ── bridge ─────────────────────────────────────────────

  private getBridge(): EpochRiseBridge | null {
    return (
      (this.game.registry.get('epochRiseBridge') as EpochRiseBridge | undefined) ??
      null
    )
  }

  private emitScore(score: number) {
    this.getBridge()?.onScoreChange(score)
  }

  private emitState(state: EpochRiseGameState) {
    this.getBridge()?.onStateChange(state)
  }

  private emitEnergy() {
    this.getBridge()?.onEnergyChange?.(this.energy, EPOCH_RISE.maxEnergy)
  }
}
