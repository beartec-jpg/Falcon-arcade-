import Phaser from 'phaser'
import {
  animateRiseEmblem,
  createRiseEmblem,
  type CharacterMood,
  type RiseEmblem,
} from '../../utils/emblemCharacters'
import {
  attachQuantumPulse,
  createDataStream,
  createDeathEmitter,
  createHowToOverlay,
  createNebulaBackdrop,
  createParallaxStarfield,
  createPauseButton,
  createPlayerTrail,
  createSparkEmitter,
  createTouchAffordances,
  drawDataStream,
  ensureJuiceTextures,
  flashCleanPass,
  floatScoreText,
  hasSeenHowTo,
  markHowToSeen,
  playDeathJuice,
  startTrail,
  stopTrail,
  updateNebulaBackdrop,
  updateParallaxStarfield,
  type NebulaBackdrop,
  type StarLayer,
  type TouchZonePair,
} from '../../utils/gameJuice'
import {
  EPOCH_COLORS,
  EPOCH_RISE,
  EPOCH_RISE_REWARD_THRESHOLD,
  EPOCH_RISE_SLUG,
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
 * Epoch Rise — vertical energy run.
 * Falcon starts at the bottom; free 2D flight while the world scrolls past.
 */
export class EpochRiseScene extends Phaser.Scene {
  private state: EpochRiseGameState = 'ready'
  private paused = false
  private waitingHowTo = false
  private score = 0
  private bestScore = 0
  private energy: number = EPOCH_RISE.maxEnergy
  private heightAccumulator = 0
  private riseSpeed: number = EPOCH_RISE.baseRiseSpeed
  private difficulty = 0
  private nextSpawnAt = 0
  private elapsedPlayMs = 0
  private streamScroll = 0

  private falcon!: Phaser.Physics.Arcade.Image
  private falconVisual!: Phaser.GameObjects.Container
  private riseEmblem!: RiseEmblem
  private entities!: Phaser.Physics.Arcade.Group

  private shieldUntil = 0
  private boostZoneUntil = 0
  private dashUntil = 0
  private invulnUntil = 0

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keyLeft!: Phaser.Input.Keyboard.Key
  private keyRight!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private keyShift!: Phaser.Input.Keyboard.Key
  private keyW!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyP!: Phaser.Input.Keyboard.Key

  /** Pointer drag target (world) while held; null when not steering by touch. */
  private pointerAim: { x: number; y: number } | null = null
  private dashDirX = 0
  private dashDirY = 0

  private starLayers: StarLayer[] = []
  private nebula!: NebulaBackdrop
  private dataStream!: Phaser.GameObjects.Graphics
  private laneGfx!: Phaser.GameObjects.Graphics
  private laneScroll = 0
  private touchUi!: TouchZonePair
  private zonesFaded = false

  private hudScore!: Phaser.GameObjects.Text
  private hudHint!: Phaser.GameObjects.Text
  private energyFill!: Phaser.GameObjects.Rectangle
  private energyLabel!: Phaser.GameObjects.Text
  private energyGlow!: Phaser.GameObjects.Rectangle
  private statusPills!: Phaser.GameObjects.Text
  private pauseDim!: Phaser.GameObjects.Rectangle
  private pauseLabel!: Phaser.GameObjects.Text
  private newBestBanner!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Container
  private collectEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private hitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter
  private wingFlap = 0

  constructor() {
    super('EpochRiseScene')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(EPOCH_COLORS.bgHex)
    this.physics.world.gravity.y = 0
    this.physics.world.setBounds(0, 0, width, height)
    ensureJuiceTextures(this)

    this.nebula = createNebulaBackdrop(this, width, height, 0)
    this.starLayers = createParallaxStarfield(this, width, height)
    this.dataStream = createDataStream(this, 1)
    this.laneGfx = this.add.graphics().setDepth(2)
    this.createTextures()

    this.entities = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    })

    const startY = this.defaultPlayerY()
    this.trail = createPlayerTrail(this, 9)
    this.riseEmblem = createRiseEmblem(this, width / 2, startY, 13)
    this.falconVisual = this.riseEmblem.root
    this.falcon = this.physics.add.image(width / 2, startY, 'falcon-hitbox')
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

    // Soft edge hints only — free 2D flight uses drag / WASD
    this.touchUi = createTouchAffordances(this, 'horizontal')
    this.touchUi.labelA.setText('DRAG')
    this.touchUi.labelB.setText('TO FLY')
    this.setupInput()
    this.createHud(width, height)
    this.createParticles()
    this.hitEmitter = createDeathEmitter(this, 30)
    this.resetRun()

    if (!hasSeenHowTo(EPOCH_RISE_SLUG)) {
      this.waitingHowTo = true
      createHowToOverlay(
        this,
        'Epoch Rise',
        [
          'Start at the bottom — the world rises past you.',
          'Move freely: WASD / arrows, or drag toward orbs.',
          'Go up for faster grabs · drop back for distant orbs.',
          'Dash (Space) bursts in your move direction. Keep energy alive.',
        ],
        () => {
          markHowToSeen(EPOCH_RISE_SLUG)
          this.waitingHowTo = false
          this.showOverlay('ready')
          this.emitState('ready')
        },
      )
    } else {
      this.showOverlay('ready')
      this.emitState('ready')
    }
    this.emitScore(0)
    this.emitEnergy()
  }

  update(_time: number, delta: number) {
    const scrollRef =
      this.state === 'playing' && !this.paused ? this.riseSpeed : 36
    updateParallaxStarfield(
      this.starLayers,
      this.scale.width,
      this.scale.height,
      scrollRef,
      delta,
      'y',
    )
    updateNebulaBackdrop(
      this.nebula,
      this.scale.width,
      this.scale.height,
      delta,
    )
    this.streamScroll += scrollRef * (delta / 1000) * 0.5
    drawDataStream(
      this.dataStream,
      this.scale.width,
      this.scale.height,
      this.streamScroll,
      'vertical',
    )
    this.drawLanes(delta)
    this.updateFalconVisual(delta)

    if (this.waitingHowTo) return

    if (
      this.keyP &&
      Phaser.Input.Keyboard.JustDown(this.keyP) &&
      this.state === 'playing'
    ) {
      this.togglePause()
    }
    if (this.paused) return

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

    this.applyMovement()
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

  private defaultPlayerY() {
    return this.scale.height * EPOCH_RISE.playerYRatio
  }

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
      this.keyLeft = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)
      this.keyRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
      this.keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.waitingHowTo || this.paused) return
      if (this.state === 'ready') {
        this.beginRun()
        return
      }
      if (this.state === 'gameover') {
        this.resetRun()
        this.beginRun()
        return
      }

      if (!this.zonesFaded) {
        this.zonesFaded = true
        this.time.delayedCall(1200, () => this.touchUi.setActive(false))
      }

      this.pointerAim = { x: pointer.x, y: pointer.y }
      // Double-tap top edge = dash in current aim
      if (pointer.y < this.scale.height * 0.12) {
        this.tryDash()
      }
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || this.state !== 'playing' || this.paused) return
      this.pointerAim = { x: pointer.x, y: pointer.y }
    })
    this.input.on('pointerup', () => {
      this.pointerAim = null
    })
  }

  private createHud(width: number, height: number) {
    this.add
      .rectangle(12, 12, 150, 52, 0x0f172a, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, EPOCH_COLORS.bronze, 0.4)
      .setDepth(40)

    this.hudScore = this.add
      .text(22, 18, 'SCORE  0', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '18px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setDepth(41)

    this.add
      .text(22, 40, `TH  ${EPOCH_RISE_REWARD_THRESHOLD}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        color: '#94a3b8',
        fontStyle: '600',
      })
      .setDepth(41)

    // Premium energy bar
    const barX = width / 2
    const barY = 30
    const barW = 240
    const barH = 16
    this.energyGlow = this.add
      .rectangle(barX, barY, barW + 10, barH + 10, EPOCH_COLORS.quantum, 0.12)
      .setDepth(40)
    this.add
      .rectangle(barX, barY, barW + 6, barH + 6, EPOCH_COLORS.panel, 0.96)
      .setStrokeStyle(1, EPOCH_COLORS.bronze, 0.55)
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
        fontSize: '11px',
        color: '#020617',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(43)

    this.statusPills = this.add
      .text(width - 56, 22, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
        color: '#d4922a',
        fontStyle: '700',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setDepth(41)

    this.hudHint = this.add
      .text(
        width / 2,
        height - 24,
        'WASD free move  ·  drag to fly  ·  SPACE dash  ·  P pause',
        {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '12px',
          color: '#94a3b8',
        },
      )
      .setOrigin(0.5)
      .setDepth(40)

    createPauseButton(this, () => {
      if (this.state === 'playing') this.togglePause()
    })

    this.pauseDim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x020617, 0.55)
      .setDepth(55)
      .setVisible(false)
    this.pauseLabel = this.add
      .text(width / 2, height / 2, 'PAUSED\nP or tap Ⅱ to resume', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '22px',
        color: '#f1f5f9',
        align: 'center',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(56)
      .setVisible(false)

    this.newBestBanner = this.add
      .text(width / 2, 72, 'NEW BEST!', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '22px',
        color: '#d4922a',
        fontStyle: '700',
        stroke: '#020617',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(48)
      .setAlpha(0)
  }

  private createParticles() {
    this.collectEmitter = createSparkEmitter(this, 30)
  }

  private togglePause() {
    if (this.state !== 'playing') return
    this.paused = !this.paused
    this.pauseDim?.setVisible(this.paused)
    this.pauseLabel?.setVisible(this.paused)
    if (this.paused) {
      stopTrail(this.trail)
      this.physics.pause()
    } else {
      this.physics.resume()
      startTrail(this.trail, this.falcon)
    }
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
    this.paused = false
    this.physics.resume()
    this.pauseDim?.setVisible(false)
    this.pauseLabel?.setVisible(false)
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
    this.zonesFaded = false
    this.touchUi?.setActive(true)
    stopTrail(this.trail)

    this.entities.clear(true, true)
    this.pointerAim = null
    this.falcon.setPosition(this.scale.width / 2, this.defaultPlayerY())
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
    if (this.waitingHowTo) return
    this.state = 'playing'
    this.hideOverlay()
    // Lock start to bottom of the playfield so runs always open low
    this.falcon.setPosition(this.scale.width / 2, this.defaultPlayerY())
    this.falcon.setVelocity(0, 0)
    this.pointerAim = null
    this.nextSpawnAt = this.time.now + 600
    this.hudHint.setText('Fly free · up for speed grabs · drop back for far orbs')
    startTrail(this.trail, this.falcon)
    this.emitState('playing')
  }

  private handleGameOver() {
    if (this.state !== 'playing' || this.paused) return
    this.state = 'gameover'
    this.falcon.setVelocity(0, 0)
    stopTrail(this.trail)

    playDeathJuice(
      this,
      this.falcon.x,
      this.falcon.y,
      this.difficulty,
      this.hitEmitter,
    )

    this.tweens.add({
      targets: this.falconVisual,
      alpha: 0.25,
      angle: 25,
      duration: 280,
      ease: 'Quad.easeOut',
    })

    this.time.delayedCall(340, () => {
      this.showOverlay('gameover')
      this.emitState('gameover')
      this.emitScore(this.score)
      this.emitEnergy()
    })
  }

  // ── movement ───────────────────────────────────────────

  /** Keyboard + drag intent in unit vector space. */
  private moveIntent(): { x: number; y: number } {
    let x = 0
    let y = 0
    if (this.cursors?.left.isDown || this.keyA?.isDown || this.keyLeft?.isDown) {
      x -= 1
    }
    if (
      this.cursors?.right.isDown ||
      this.keyD?.isDown ||
      this.keyRight?.isDown
    ) {
      x += 1
    }
    if (this.cursors?.up.isDown || this.keyW?.isDown) {
      y -= 1
    }
    if (this.cursors?.down.isDown || this.keyS?.isDown) {
      y += 1
    }

    // Drag toward pointer for free 2D mobile control
    if (this.pointerAim && this.state === 'playing') {
      const dx = this.pointerAim.x - this.falcon.x
      const dy = this.pointerAim.y - this.falcon.y
      const len = Math.hypot(dx, dy)
      if (len > 14) {
        x = dx / len
        y = dy / len
      }
    }

    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y }
  }

  private applyMovement() {
    if (this.state === 'playing') {
      const dashPressed =
        (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) ||
        (this.keyShift && Phaser.Input.Keyboard.JustDown(this.keyShift))

      if (dashPressed) {
        this.tryDash()
      }
    }

    const dashing = this.time.now < this.dashUntil
    const speed = dashing ? EPOCH_RISE.boostSpeed : EPOCH_RISE.moveSpeed
    const intent = this.moveIntent()

    if (dashing) {
      this.falcon.setVelocity(
        this.dashDirX * speed,
        this.dashDirY * speed,
      )
    } else {
      this.falcon.setVelocity(intent.x * speed, intent.y * speed)
    }

    // Soft playfield clamps (keep ship bottom-biased but free to climb)
    const { width, height } = this.scale
    const padX = 48
    const top = height * EPOCH_RISE.playTopRatio
    const bottom = height * EPOCH_RISE.playBottomRatio
    this.falcon.x = Phaser.Math.Clamp(this.falcon.x, padX, width - padX)
    this.falcon.y = Phaser.Math.Clamp(this.falcon.y, top, bottom)
  }

  private tryDash() {
    if (this.state !== 'playing') return
    if (this.time.now < this.dashUntil) return
    if (this.energy < EPOCH_RISE.boostEnergyCost) return

    const intent = this.moveIntent()
    // Default dash upward-forward (rise) if idle
    let dx = intent.x
    let dy = intent.y
    if (Math.hypot(dx, dy) < 0.15) {
      dx = 0
      dy = -1
    }
    const len = Math.hypot(dx, dy) || 1
    this.changeEnergy(-EPOCH_RISE.boostEnergyCost)
    this.dashDirX = dx / len
    this.dashDirY = dy / len
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
    const bob = Math.sin(this.wingFlap / 280) * 5
    const baseY = this.defaultPlayerY()
    this.falcon.x = this.scale.width / 2
    this.falcon.y = baseY + bob
    this.falconVisual.x = this.falcon.x
    this.falconVisual.y = this.falcon.y
  }

  private updateFalconVisual(delta: number) {
    if (!this.falconVisual || !this.falcon || !this.riseEmblem) return
    this.falconVisual.x = this.falcon.x
    this.falconVisual.y = this.falcon.y

    this.wingFlap += delta * (this.state === 'playing' ? 1.45 : 0.75)
    const vx = this.falcon.body?.velocity.x ?? 0
    const bank =
      this.state === 'playing' ? Phaser.Math.Clamp(vx / 18, -22, 22) : 0

    let mood: CharacterMood = 'idle'
    if (this.state === 'gameover') mood = 'dead'
    else if (this.state === 'playing') {
      if (this.time.now < this.shieldUntil) mood = 'shield'
      else if (
        this.time.now < this.boostZoneUntil ||
        this.time.now < this.dashUntil
      ) {
        mood = 'boost'
      } else if (this.energy < EPOCH_RISE.maxEnergy * 0.28) mood = 'danger'
      else mood = 'play'
    }

    animateRiseEmblem(this.riseEmblem, delta, this.wingFlap, mood, bank)
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
    if (this.score === prev) return

    this.hudScore.setText(`SCORE  ${this.score}`)
    if (
      this.score >= EPOCH_RISE_REWARD_THRESHOLD &&
      prev < EPOCH_RISE_REWARD_THRESHOLD
    ) {
      this.hudScore.setColor('#d4922a')
      this.cameras.main.flash(90, 208, 146, 42, false)
      floatScoreText(this, this.falcon.x, this.falcon.y - 40, 'THRESHOLD!', '#d4922a', {
        fontSize: '18px',
      })
    }
    if (this.score > this.bestScore) {
      const was = this.bestScore
      this.bestScore = this.score
      if (was > 0) {
        this.newBestBanner.setAlpha(0).setScale(0.7).setY(72)
        this.tweens.add({
          targets: this.newBestBanner,
          alpha: 1,
          scale: 1.1,
          duration: 180,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: this.newBestBanner,
              alpha: 0,
              y: 48,
              delay: 700,
              duration: 350,
            })
          },
        })
      }
    }
    this.tweens.add({
      targets: this.hudScore,
      scale: 1.08,
      duration: 70,
      yoyo: true,
    })
    this.emitScore(this.score)
  }

  private refreshEnergyBar() {
    const pct = this.energy / EPOCH_RISE.maxEnergy
    const barW = 240
    this.energyFill.width = Math.max(2, barW * pct)
    const low = pct < 0.28
    this.energyFill.setFillStyle(low ? EPOCH_COLORS.energyLow : EPOCH_COLORS.energy)
    this.energyLabel.setText(`ENERGY  ${Math.ceil(this.energy)}`)
    this.energyLabel.setColor(low ? '#f1f5f9' : '#020617')
    if (this.energyGlow) {
      this.energyGlow.setFillStyle(
        low ? EPOCH_COLORS.danger : EPOCH_COLORS.quantum,
        low ? 0.18 : 0.12,
      )
      this.energyGlow.setScale(1 + (1 - pct) * 0.04)
    }
  }

  private refreshHudStatus() {
    const tags: string[] = []
    if (this.time.now < this.shieldUntil) tags.push('SHIELD')
    if (this.time.now < this.boostZoneUntil) tags.push('BOOST')
    if (this.time.now < this.dashUntil) tags.push('DASH')
    this.statusPills.setText(tags.join('  ·  '))
  }

  private floatText(x: number, y: number, text: string, color: string) {
    floatScoreText(this, x, y, text, color)
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
    const obj = this.spawnAtTop('interference', w, 52, { kind: 'interference' })
    attachQuantumPulse(this, obj)
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
        this.collectEmitter.explode(12)
        flashCleanPass(this, 0.08)
        this.floatText(ent.x, ent.y, `+${EPOCH_RISE.orbScore}`, '#22d3ee')
        ent.destroy()
        break

      case 'cluster-orb':
        if (meta.scored) return
        meta.scored = true
        this.changeEnergy(EPOCH_RISE.clusterOrbEnergy)
        this.addScore(EPOCH_RISE.clusterOrbScore)
        this.collectEmitter.setPosition(ent.x, ent.y)
        this.collectEmitter.explode(16)
        flashCleanPass(this)
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
