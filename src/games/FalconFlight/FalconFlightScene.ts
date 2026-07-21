import Phaser from 'phaser'
import {
  animateFlightEmblem,
  createFlightEmblem,
  type CharacterMood,
  type FlightEmblem,
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
  nearMissSpark,
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
  FALCON_COLORS,
  FALCON_FLIGHT,
  FALCON_FLIGHT_REWARD_THRESHOLD,
  FALCON_FLIGHT_SLUG,
  type FalconFlightBridge,
  type FalconFlightGameState,
} from './falconFlightConfig'

type ObstacleKind =
  | 'ledger'
  | 'quantum'
  | 'float'
  | 'weave'
  | 'spires'
  | 'diamond'
  | 'shards'
  | 'windows'
  | 'chevrons'
  | 'portal'
  | 'laser'
  | 'jaws'
  | 'wind'
  | 'coin'

type ObstacleMeta = {
  kind: ObstacleKind
  scored: boolean
  gapCenterY?: number
  gapHalf?: number
  /** Shared id so multi-piece sets only award one clear bonus */
  setId?: number
  /** Optional vertical bob / special motion while scrolling */
  motion?: 'sineY' | 'jaws' | 'laser'
  baseY?: number
  amp?: number
  phase?: number
  bobSpeed?: number
  /** Non-lethal (portal core, wind, coins, lane markers) */
  noDamage?: boolean
  isPortal?: boolean
  isWind?: boolean
  /** +1 shove up, -1 shove down (px/s scale) */
  windForce?: number
  /** Closing jaws */
  gapStart?: number
  gapMin?: number
  closeRate?: number
  jawProgress?: number
  jawRole?: 'top' | 'bot'
  /** Laser on/off pulse */
  laserActive?: boolean
  /** Coin value */
  coinValue?: number
  used?: boolean
}

type GateBias = 'high' | 'mid' | 'low' | 'random'

/**
 * Structured spawn waves — one family per batch so you never get
 * floaters stacked inside windows, etc. Rotates as a playlist.
 */
type WavePattern =
  | 'ledger'
  | 'ledger_highlow'
  | 'spires'
  | 'quantum'
  | 'float'
  | 'weave'
  | 'windows'
  | 'chevrons'
  | 'diamonds'
  | 'shards'
  | 'jaws'
  | 'lasers'
  | 'wind'
  | 'portal_skip'

type ObstacleTex =
  | 'ledger-block'
  | 'quantum-bar'
  | 'flight-spire-up'
  | 'flight-spire-down'
  | 'flight-diamond'
  | 'flight-shard'
  | 'flight-chevron'
  | 'flight-portal'
  | 'flight-laser'
  | 'flight-wind'
  | 'flight-coin'

/**
 * Falcon Flight — horizontal auto-scroller with juice pass.
 */
export class FalconFlightScene extends Phaser.Scene {
  private state: FalconFlightGameState = 'ready'
  private paused = false
  private score = 0
  private bestScore = 0
  private distanceAccumulator = 0
  private scrollSpeed: number = FALCON_FLIGHT.baseScrollSpeed
  private difficulty = 0
  private nextSpawnAt = 0
  private elapsedPlayMs = 0
  private streamScroll = 0
  private waitingHowTo = false

  private falcon!: Phaser.Physics.Arcade.Image
  private falconVisual!: Phaser.GameObjects.Container
  private flightEmblem!: FlightEmblem
  private obstacles!: Phaser.Physics.Arcade.Group
  private starLayers: StarLayer[] = []
  private nebula!: NebulaBackdrop
  private dataStream!: Phaser.GameObjects.Graphics

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyW!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyUp!: Phaser.Input.Keyboard.Key
  private keyDown!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private keyP!: Phaser.Input.Keyboard.Key

  private pointerUpHeld = false
  private pointerDownHeld = false
  private touchZone: 'none' | 'up' | 'down' = 'none'
  private touchUi!: TouchZonePair
  private zonesFaded = false

  private hudScore!: Phaser.GameObjects.Text
  private hudHint!: Phaser.GameObjects.Text
  private pauseDim!: Phaser.GameObjects.Rectangle
  private pauseLabel!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Container
  private deathEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter
  private newBestBanner!: Phaser.GameObjects.Text

  private wingFlap = 0
  /** Last gate center Y — used to avoid mid-only corridors. */
  private lastGapCenterY = 0
  private obstacleSetId = 0
  /** Cancelled on restart so "Signal Lost" cannot pop mid-flight. */
  private gameOverTimer?: Phaser.Time.TimerEvent
  /** Brief spawn protection after launch / restart. */
  private invulnUntil = 0
  /** Mid-portal blink: vanish → skip next hazard → reappear. */
  private teleporting = false

  // ── Wave director (structured progression) ─────────────
  private waveIndex = 0
  private wavePattern: WavePattern = 'ledger'
  private waveRemaining = 0
  private waveStep = 0
  private waveLabelUntil = 0

  constructor() {
    super('FalconFlightScene')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(FALCON_COLORS.bgHex)
    ensureJuiceTextures(this)

    this.nebula = createNebulaBackdrop(this, width, height, 0)
    this.starLayers = createParallaxStarfield(this, width, height)
    this.dataStream = createDataStream(this, 1)
    this.createTextures()

    this.obstacles = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    })

    this.trail = createPlayerTrail(this, 9)
    this.flightEmblem = createFlightEmblem(
      this,
      FALCON_FLIGHT.playerX,
      height / 2,
      11,
    )
    this.falconVisual = this.flightEmblem.root
    this.falcon = this.physics.add.image(
      FALCON_FLIGHT.playerX,
      height / 2,
      'falcon-hitbox',
    )
    this.falcon.setVisible(false)
    this.falcon.setCircle(FALCON_FLIGHT.playerRadius)
    this.falcon.body?.setOffset(
      16 - FALCON_FLIGHT.playerRadius,
      16 - FALCON_FLIGHT.playerRadius,
    )
    this.falcon.setCollideWorldBounds(true)
    this.falcon.setGravity(0, 0)
    this.falcon.setDepth(10)

    this.physics.add.overlap(
      this.falcon,
      this.obstacles,
      (_f, o) =>
        this.onObstacleOverlap(o as Phaser.Physics.Arcade.Image),
      (_f, o) =>
        this.shouldProcessObstacle(o as Phaser.Physics.Arcade.Image),
      this,
    )

    this.touchUi = createTouchAffordances(this, 'vertical')
    this.touchUi.labelA.setText('ABOVE')
    this.touchUi.labelB.setText('BELOW')
    this.setupInput()
    this.createHud(width, height)
    this.deathEmitter = createDeathEmitter(this)
    this.sparkEmitter = createSparkEmitter(this)
    this.resetRun(false)

    if (!hasSeenHowTo(FALCON_FLIGHT_SLUG)) {
      this.waitingHowTo = true
      createHowToOverlay(
        this,
        'Falcon Flight',
        [
          'Fly forward automatically.',
          'Touch above the falcon to climb · below to dive (or ↑↓ / W S).',
          'Spires, lasers, jaws, wind & portals — fly a gold portal to blink past the next hazard.',
          `Reach ${FALCON_FLIGHT_REWARD_THRESHOLD} to unlock Claim.`,
        ],
        () => {
          markHowToSeen(FALCON_FLIGHT_SLUG)
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
  }

  update(_time: number, delta: number) {
    const scrollRef =
      this.state === 'playing' && !this.paused ? this.scrollSpeed : 36
    updateParallaxStarfield(
      this.starLayers,
      this.scale.width,
      this.scale.height,
      scrollRef,
      delta,
      'x',
    )
    updateNebulaBackdrop(
      this.nebula,
      this.scale.width,
      this.scale.height,
      delta,
    )
    this.streamScroll += scrollRef * (delta / 1000) * 0.45
    drawDataStream(
      this.dataStream,
      this.scale.width,
      this.scale.height,
      this.streamScroll,
      'horizontal',
    )

    if (this.waitingHowTo) return

    if (
      this.keyP &&
      Phaser.Input.Keyboard.JustDown(this.keyP) &&
      this.state === 'playing'
    ) {
      this.togglePause()
    }

    if (this.paused) return

    this.updateFalconVisual(delta)

    if (this.state === 'ready') {
      this.bobFalconIdle(delta)
      if (this.wantsStart()) this.beginRun()
      return
    }

    if (this.state === 'gameover') {
      if (this.wantsStart()) {
        this.resetRun(true)
        this.beginRun()
      }
      return
    }

    this.elapsedPlayMs += delta
    this.difficulty = Phaser.Math.Clamp(
      this.elapsedPlayMs / (FALCON_FLIGHT.difficultyRampSeconds * 1000),
      0,
      1,
    )
    this.scrollSpeed = Phaser.Math.Linear(
      FALCON_FLIGHT.baseScrollSpeed,
      FALCON_FLIGHT.maxScrollSpeed,
      this.difficulty,
    )

    this.applyVerticalMovement()
    this.advanceScore(delta)
    this.spawnObstaclesIfNeeded()
    this.updateObstacles(delta)
    this.cullObstacles()

    // Clear wave banner once its timer ends
    if (
      this.waveLabelUntil > 0 &&
      this.time.now > this.waveLabelUntil &&
      this.state === 'playing'
    ) {
      this.waveLabelUntil = 0
      this.hudHint.setText(
        'Touch above/below bird · weave gaps · claim at 500',
      )
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
    if (!this.textures.exists('ledger-block')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 64
      const h = 64
      g.fillStyle(FALCON_COLORS.ledgerFace, 1)
      g.fillRoundedRect(0, 0, w, h, 6)
      g.lineStyle(2, FALCON_COLORS.bronze, 0.9)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 6)
      g.lineStyle(1, FALCON_COLORS.bronzeDark, 0.55)
      for (let y = 14; y < h - 8; y += 10) g.lineBetween(10, y, w - 10, y)
      g.fillStyle(FALCON_COLORS.bronze, 0.15)
      g.fillRect(8, 8, w - 16, 6)
      g.generateTexture('ledger-block', w, h)
      g.destroy()
    }
    if (!this.textures.exists('quantum-bar')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 28
      const h = 64
      g.fillStyle(FALCON_COLORS.quantumDim, 0.95)
      g.fillRect(0, 0, w, h)
      g.lineStyle(2, FALCON_COLORS.quantum, 0.95)
      g.strokeRect(1, 1, w - 2, h - 2)
      g.lineStyle(1, FALCON_COLORS.quantum, 0.5)
      for (let i = -h; i < w + h; i += 8) g.lineBetween(i, 0, i + h, h)
      g.generateTexture('quantum-bar', w, h)
      g.destroy()
    }

    // Stalagmite — bronze crystal spike (point up)
    if (!this.textures.exists('flight-spire-up')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 48
      const h = 72
      g.fillStyle(FALCON_COLORS.bronzeDark, 1)
      g.fillTriangle(w / 2, 2, 4, h - 4, w - 4, h - 4)
      g.fillStyle(FALCON_COLORS.bronze, 0.95)
      g.fillTriangle(w / 2, 10, 12, h - 6, w - 12, h - 6)
      g.lineStyle(2, FALCON_COLORS.bronzeBright, 0.9)
      g.strokeTriangle(w / 2, 2, 4, h - 4, w - 4, h - 4)
      g.lineStyle(1.5, FALCON_COLORS.quantum, 0.45)
      g.lineBetween(w / 2, 12, w / 2, h - 10)
      g.generateTexture('flight-spire-up', w, h)
      g.destroy()
    }

    // Stalactite — hanging spike (point down)
    if (!this.textures.exists('flight-spire-down')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 48
      const h = 72
      g.fillStyle(FALCON_COLORS.bronzeDark, 1)
      g.fillTriangle(w / 2, h - 2, 4, 4, w - 4, 4)
      g.fillStyle(FALCON_COLORS.bronze, 0.95)
      g.fillTriangle(w / 2, h - 10, 12, 6, w - 12, 6)
      g.lineStyle(2, FALCON_COLORS.bronzeBright, 0.9)
      g.strokeTriangle(w / 2, h - 2, 4, 4, w - 4, 4)
      g.generateTexture('flight-spire-down', w, h)
      g.destroy()
    }

    // Oscillating diamond / saw node
    if (!this.textures.exists('flight-diamond')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 56
      const c = s / 2
      g.fillStyle(FALCON_COLORS.danger, 0.95)
      g.fillTriangle(c, 2, s - 4, c, c, s - 2)
      g.fillTriangle(c, 2, 4, c, c, s - 2)
      g.fillStyle(FALCON_COLORS.bronzeBright, 0.55)
      g.fillTriangle(c, 12, s - 14, c, c, s - 12)
      g.lineStyle(2, FALCON_COLORS.quantumHot, 0.9)
      g.strokeTriangle(c, 2, s - 4, c, 4, c)
      g.strokeTriangle(c, s - 2, s - 4, c, 4, c)
      g.fillStyle(FALCON_COLORS.quantumHot, 0.95)
      g.fillCircle(c, c, 5)
      g.generateTexture('flight-diamond', s, s)
      g.destroy()
    }

    // Small shard for cluster clouds
    if (!this.textures.exists('flight-shard')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 28
      const h = 36
      g.fillStyle(FALCON_COLORS.quantum, 0.9)
      g.fillTriangle(w / 2, 2, 2, h - 2, w - 2, h - 2)
      g.lineStyle(1.5, FALCON_COLORS.quantumHot, 0.95)
      g.strokeTriangle(w / 2, 2, 2, h - 2, w - 2, h - 2)
      g.generateTexture('flight-shard', w, h)
      g.destroy()
    }

    // Chevron wedge (points right — “ledger arrow”)
    if (!this.textures.exists('flight-chevron')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 52
      const h = 48
      g.fillStyle(FALCON_COLORS.ledgerFace, 1)
      g.fillTriangle(4, 4, 4, h - 4, w - 2, h / 2)
      g.lineStyle(2, FALCON_COLORS.bronze, 0.95)
      g.strokeTriangle(4, 4, 4, h - 4, w - 2, h / 2)
      g.lineStyle(1.5, FALCON_COLORS.quantum, 0.5)
      g.lineBetween(10, h / 2, w - 12, h / 2)
      g.generateTexture('flight-chevron', w, h)
      g.destroy()
    }

    // Teleport portal ring
    if (!this.textures.exists('flight-portal')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 72
      const c = s / 2
      g.lineStyle(8, FALCON_COLORS.bronzeBright, 1)
      g.strokeCircle(c, c, 28)
      g.lineStyle(4, FALCON_COLORS.quantum, 0.95)
      g.strokeCircle(c, c, 22)
      g.lineStyle(2, FALCON_COLORS.quantumHot, 0.7)
      g.strokeCircle(c, c, 14)
      g.fillStyle(FALCON_COLORS.quantum, 0.2)
      g.fillCircle(c, c, 12)
      g.generateTexture('flight-portal', s, s)
      g.destroy()
    }

    // Horizontal laser bar
    if (!this.textures.exists('flight-laser')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 120
      const h = 14
      g.fillStyle(FALCON_COLORS.danger, 0.95)
      g.fillRoundedRect(0, 2, w, h - 4, 4)
      g.fillStyle(0xffffff, 0.85)
      g.fillRoundedRect(8, 5, w - 16, 4, 2)
      g.lineStyle(1.5, FALCON_COLORS.quantumHot, 0.9)
      g.strokeRoundedRect(0, 2, w, h - 4, 4)
      g.generateTexture('flight-laser', w, h)
      g.destroy()
    }

    // Wind gust field
    if (!this.textures.exists('flight-wind')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 64
      const h = 96
      g.fillStyle(FALCON_COLORS.quantum, 0.12)
      g.fillRoundedRect(0, 0, w, h, 8)
      g.lineStyle(2, FALCON_COLORS.quantum, 0.55)
      for (let i = 0; i < 5; i++) {
        const y = 12 + i * 16
        g.lineBetween(10, y, w - 14, y - 6)
        g.lineBetween(w - 14, y - 6, w - 8, y)
      }
      g.generateTexture('flight-wind', w, h)
      g.destroy()
    }

    // Safe-lane coin / marker
    if (!this.textures.exists('flight-coin')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 20
      const c = s / 2
      g.fillStyle(FALCON_COLORS.bronzeBright, 1)
      g.fillCircle(c, c, 8)
      g.lineStyle(2, FALCON_COLORS.bronze, 1)
      g.strokeCircle(c, c, 8)
      g.fillStyle(0xf0c14a, 0.9)
      g.fillCircle(c, c, 3.5)
      g.generateTexture('flight-coin', s, s)
      g.destroy()
    }
  }

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
      this.keyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
      this.keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      this.keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.waitingHowTo || this.paused) return
      if (this.state === 'ready') {
        this.beginRun()
        return
      }
      if (this.state === 'gameover') {
        this.resetRun(true)
        this.beginRun()
        return
      }
      this.fadeTouchZonesOnce()
      this.applyPointerSteer(pointer.y)
      if (this.touchZone === 'up') this.touchUi.pulse('a')
      else if (this.touchZone === 'down') this.touchUi.pulse('b')
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || this.paused) return
      if (this.state !== 'playing') return
      this.applyPointerSteer(pointer.y)
    })
    this.input.on('pointerup', () => {
      this.pointerUpHeld = false
      this.pointerDownHeld = false
      this.touchZone = 'none'
    })
  }

  /**
   * Touch relative to the falcon: above bird = climb, below = dive.
   * Small dead-zone around the bird holds altitude for fine aiming.
   */
  private applyPointerSteer(pointerY: number) {
    const dead = FALCON_FLIGHT.touchDeadZone * Math.min(1.25, this.hScale())
    const birdY = this.falcon?.y ?? this.scale.height / 2
    if (pointerY < birdY - dead) {
      this.touchZone = 'up'
      this.pointerUpHeld = true
      this.pointerDownHeld = false
    } else if (pointerY > birdY + dead) {
      this.touchZone = 'down'
      this.pointerUpHeld = false
      this.pointerDownHeld = true
    } else {
      // Hold — don’t fight the player with micro-jitter
      this.touchZone = 'none'
      this.pointerUpHeld = false
      this.pointerDownHeld = false
    }
  }

  private fadeTouchZonesOnce() {
    if (this.zonesFaded) return
    this.zonesFaded = true
    this.time.delayedCall(1400, () => this.touchUi.setActive(false))
  }

  private createHud(width: number, height: number) {
    const panel = this.add
      .rectangle(12, 12, 168, 58, 0x0f172a, 0.82)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FALCON_COLORS.bronze, 0.35)
      .setDepth(30)

    this.hudScore = this.add
      .text(22, 18, 'SCORE  0', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '20px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setDepth(31)

    this.add
      .text(22, 44, `THRESHOLD  ${FALCON_FLIGHT_REWARD_THRESHOLD}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        color: '#94a3b8',
        fontStyle: '600',
      })
      .setDepth(31)

    this.hudHint = this.add
      .text(
        width / 2,
        height - 24,
        '↑↓ / W S  ·  touch above/below bird  ·  P pause  ·  SPACE start',
        {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '12px',
          color: '#94a3b8',
        },
      )
      .setOrigin(0.5)
      .setDepth(30)

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

    void panel
  }

  private togglePause() {
    if (this.state !== 'playing') return
    this.paused = !this.paused
    this.pauseDim.setVisible(this.paused)
    this.pauseLabel.setVisible(this.paused)
    if (this.paused) {
      stopTrail(this.trail)
      this.physics.pause()
    } else {
      this.physics.resume()
      startTrail(this.trail, this.falcon)
    }
  }

  private createOverlay() {
    if (this.overlay) this.overlay.destroy(true)
    const { width, height } = this.scale
    const container = this.add.container(width / 2, height / 2).setDepth(40)
    const panel = this.add
      .rectangle(0, 0, 420, 210, FALCON_COLORS.panel, 0.95)
      .setStrokeStyle(2, FALCON_COLORS.bronze, 0.75)
    const title = this.add
      .text(0, -58, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '30px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setOrigin(0.5)
    const body = this.add
      .text(0, -8, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '15px',
        color: '#94a3b8',
        align: 'center',
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5)
    const cta = this.add
      .text(0, 62, '', {
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
    container.setSize(420, 210)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-210, -105, 420, 210),
      Phaser.Geom.Rectangle.Contains,
    )
    container.on('pointerdown', () => {
      if (this.state === 'ready') this.beginRun()
      else if (this.state === 'gameover') {
        this.resetRun(true)
        this.beginRun()
      }
    })
    this.overlay = container
  }

  private showOverlay(mode: 'ready' | 'gameover') {
    // Never show game-over chrome unless we are actually dead
    if (mode === 'gameover' && this.state !== 'gameover') return

    this.createOverlay()
    const title = this.overlay.getData('title') as Phaser.GameObjects.Text
    const body = this.overlay.getData('body') as Phaser.GameObjects.Text
    const cta = this.overlay.getData('cta') as Phaser.GameObjects.Text
    if (mode === 'ready') {
      title.setText('Falcon Flight')
      body.setText(
        'Fly forward. Touch above/below the bird. Gold portals warp you past the next hazard — also lasers, jaws, wind & spires.',
      )
      cta.setText('TAP / SPACE TO LAUNCH')
    } else {
      title.setText('Signal Lost')
      body.setText(
        `Final score  ${this.score}\nClear ${FALCON_FLIGHT_REWARD_THRESHOLD} points to unlock Claim.`,
      )
      cta.setText('TAP / SPACE TO RESTART')
    }
    this.overlay.setVisible(true)
    this.overlay.setActive(true)
  }

  private hideOverlay() {
    if (!this.overlay) return
    this.overlay.setVisible(false)
    this.overlay.setActive(false)
    // Drop interactive hit target so it cannot block play input
    if (this.overlay.input) this.overlay.disableInteractive()
  }

  private clearGameOverTimer() {
    if (this.gameOverTimer) {
      this.gameOverTimer.remove(false)
      this.gameOverTimer = undefined
    }
  }

  // ── lifecycle ──────────────────────────────────────────

  private resetRun(_preserveBest: boolean) {
    this.clearGameOverTimer()
    this.state = 'ready'
    this.paused = false
    this.physics.resume()
    this.pauseDim?.setVisible(false)
    this.pauseLabel?.setVisible(false)
    this.score = 0
    this.distanceAccumulator = 0
    this.scrollSpeed = FALCON_FLIGHT.baseScrollSpeed
    this.difficulty = 0
    this.elapsedPlayMs = 0
    this.nextSpawnAt = 0
    this.zonesFaded = false
    this.touchUi.setActive(true)
    stopTrail(this.trail)

    this.obstacles.clear(true, true)
    this.lastGapCenterY = 0
    this.teleporting = false
    this.waveIndex = 0
    this.waveRemaining = 0
    this.waveStep = 0
    this.wavePattern = 'ledger'
    this.waveLabelUntil = 0
    this.pointerUpHeld = false
    this.pointerDownHeld = false
    this.touchZone = 'none'
    this.falcon.setPosition(FALCON_FLIGHT.playerX, this.scale.height / 2)
    this.falcon.setVelocity(0, 0)
    this.falconVisual.setPosition(this.falcon.x, this.falcon.y)
    this.falconVisual.setAlpha(1)
    this.falconVisual.setAngle(0)
    this.tweens.killTweensOf(this.falconVisual)
    this.hudScore.setText('SCORE  0')
    this.hudScore.setColor('#f1f5f9')
    this.hideOverlay()
    this.emitScore(0)
  }

  private beginRun() {
    if (this.waitingHowTo) return
    this.clearGameOverTimer()
    this.state = 'playing'
    this.hideOverlay()
    // Grace window so leftover collisions / spawn edge cannot flash "Signal Lost"
    this.nextSpawnAt = this.time.now + 900
    this.invulnUntil = this.time.now + 700
    this.lastGapCenterY = this.falcon.y
    this.waveIndex = 0
    this.waveRemaining = 0
    this.waveStep = 0
    this.wavePattern = 'ledger'
    this.waveLabelUntil = 0
    this.falconVisual.setAlpha(1)
    this.falconVisual.setAngle(0)
    this.tweens.killTweensOf(this.falconVisual)
    this.hudHint.setText(
      'Touch above/below bird · weave gaps · claim at 500',
    )
    startTrail(this.trail, this.falcon)
    this.emitState('playing')
  }

  private handleCrash() {
    if (this.state !== 'playing' || this.paused) return
    this.state = 'gameover'
    this.falcon.setVelocity(0, 0)
    stopTrail(this.trail)
    this.clearGameOverTimer()

    playDeathJuice(
      this,
      this.falcon.x,
      this.falcon.y,
      this.difficulty,
      this.deathEmitter,
    )

    this.tweens.killTweensOf(this.falconVisual)
    this.tweens.add({
      targets: this.falconVisual,
      alpha: 0.2,
      angle: 22,
      duration: 280,
      ease: 'Quad.easeOut',
    })

    this.gameOverTimer = this.time.delayedCall(340, () => {
      this.gameOverTimer = undefined
      // Only show if we are still on the death screen (not restarted)
      if (this.state !== 'gameover') return
      this.showOverlay('gameover')
      this.emitState('gameover')
      this.emitScore(this.score)
    })
  }

  private wantsStart(): boolean {
    return Boolean(this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace))
  }

  private verticalIntent(): number {
    let dir = 0
    if (this.cursors?.up.isDown || this.keyW?.isDown || this.keyUp?.isDown) dir -= 1
    if (this.cursors?.down.isDown || this.keyS?.isDown || this.keyDown?.isDown) dir += 1
    if (this.pointerUpHeld || this.touchZone === 'up') dir -= 1
    if (this.pointerDownHeld || this.touchZone === 'down') dir += 1
    return Phaser.Math.Clamp(dir, -1, 1)
  }

  private applyVerticalMovement() {
    const intent = this.verticalIntent()
    if (intent !== 0) this.fadeTouchZonesOnce()
    // Scale steer speed with playfield height so tall phones stay responsive
    const speed = FALCON_FLIGHT.verticalSpeed * this.hScale()
    this.falcon.setVelocityY(intent * speed)

    const pad = 28 * this.hScale()
    const body = this.falcon.body as Phaser.Physics.Arcade.Body
    if (this.falcon.y < pad) {
      this.falcon.y = pad
      body.updateFromGameObject()
      this.falcon.setVelocityY(Math.max(0, this.falcon.body?.velocity.y ?? 0))
    }
    if (this.falcon.y > this.scale.height - pad) {
      this.falcon.y = this.scale.height - pad
      body.updateFromGameObject()
      this.falcon.setVelocityY(Math.min(0, this.falcon.body?.velocity.y ?? 0))
    }
  }

  private bobFalconIdle(delta: number) {
    const t = this.time.now / 400
    const y = this.scale.height / 2 + Math.sin(t) * 10
    this.falcon.y = y
    this.falconVisual.y = y
    this.falconVisual.x = this.falcon.x
    this.wingFlap += delta
  }

  private updateFalconVisual(delta: number) {
    if (!this.falconVisual || !this.falcon || !this.flightEmblem) return
    this.falconVisual.x = this.falcon.x
    this.falconVisual.y = this.falcon.y

    this.wingFlap += delta * (this.state === 'playing' ? 1.15 + this.difficulty * 0.4 : 0.7)
    const vy = this.falcon.body?.velocity.y ?? 0
    const pitch =
      this.state === 'playing' ? Phaser.Math.Clamp(vy / 16, -24, 24) : 0
    const speedFactor =
      this.state === 'playing'
        ? this.scrollSpeed / FALCON_FLIGHT.baseScrollSpeed
        : 0.85

    let mood: CharacterMood = 'idle'
    if (this.state === 'gameover') mood = 'dead'
    else if (this.state === 'playing') {
      mood = this.difficulty > 0.55 || speedFactor > 1.35 ? 'boost' : 'play'
    }

    animateFlightEmblem(this.flightEmblem, delta, this.wingFlap, mood, pitch, {
      vy,
      speedFactor,
    })
  }

  private advanceScore(delta: number) {
    const speedFactor = this.scrollSpeed / FALCON_FLIGHT.baseScrollSpeed
    this.distanceAccumulator +=
      (FALCON_FLIGHT.distancePointsPerSecond * speedFactor * delta) / 1000
    while (this.distanceAccumulator >= 1) {
      this.distanceAccumulator -= 1
      this.addScore(1)
    }
  }

  private addScore(amount: number) {
    const prev = this.score
    this.score += amount
    if (this.score === prev) return

    this.hudScore.setText(`SCORE  ${this.score}`)
    if (
      this.score >= FALCON_FLIGHT_REWARD_THRESHOLD &&
      prev < FALCON_FLIGHT_REWARD_THRESHOLD
    ) {
      this.hudScore.setColor('#d4922a')
      this.cameras.main.flash(90, 208, 146, 42, false)
      floatScoreText(
        this,
        this.falcon.x,
        this.falcon.y - 36,
        'THRESHOLD!',
        '#d4922a',
        { fontSize: '18px' },
      )
    }

    if (this.score > this.bestScore) {
      const was = this.bestScore
      this.bestScore = this.score
      if (was > 0 && this.score > was) this.showNewBest()
    }

    this.tweens.add({
      targets: this.hudScore,
      scale: 1.08,
      duration: 70,
      yoyo: true,
    })
    this.emitScore(this.score)
  }

  private showNewBest() {
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

  // ── obstacles ──────────────────────────────────────────

  /** Scale design-time pixel values to the live playfield height. */
  private hScale() {
    return this.scale.height / FALCON_FLIGHT.designHeight
  }

  /** Soft height scale for spacing that must not explode on tall phones. */
  private softH() {
    return Phaser.Math.Clamp(this.hScale(), 0.95, 1.2)
  }

  private currentGapHeight(narrow = false): number {
    const { height } = this.scale
    const ratio = Phaser.Math.Linear(
      FALCON_FLIGHT.gapMaxRatio,
      FALCON_FLIGHT.gapMinRatio,
      this.difficulty,
    )
    let gap = height * (narrow ? ratio * 0.82 : ratio)
    const floor =
      FALCON_FLIGHT.gapFloorPx * this.softH() +
      FALCON_FLIGHT.playerRadius * 2 +
      28
    gap = Math.max(floor, gap)
    const maxGap = height * 0.42
    return Math.min(gap, maxGap)
  }

  /**
   * Patterns unlocked by difficulty — early game is clean gates,
   * later waves introduce specials. Always one family per wave.
   */
  private unlockedWavePatterns(): WavePattern[] {
    const d = this.difficulty
    // Intro curriculum (always available)
    const list: WavePattern[] = [
      'ledger',
      'ledger_highlow',
      'spires',
      'quantum',
    ]
    if (d >= 0.1) list.push('float', 'weave')
    if (d >= 0.18) list.push('windows', 'chevrons')
    if (d >= 0.28) list.push('diamonds', 'shards')
    if (d >= 0.38) list.push('jaws', 'lasers')
    if (d >= 0.48) list.push('wind', 'portal_skip')
    // Late-game: extra ledger beats so the playlist doesn't feel only chaos
    if (d >= 0.55) list.push('ledger', 'weave', 'spires')
    return list
  }

  private waveDisplayName(p: WavePattern): string {
    switch (p) {
      case 'ledger':
        return 'LEDGER GATES'
      case 'ledger_highlow':
        return 'HIGH / LOW GATES'
      case 'spires':
        return 'CRYSTAL SPIRES'
      case 'quantum':
        return 'QUANTUM BARS'
      case 'float':
        return 'FLOATERS'
      case 'weave':
        return 'WEAVE COLUMNS'
      case 'windows':
        return 'DOUBLE WINDOWS'
      case 'chevrons':
        return 'CHEVRON GATES'
      case 'diamonds':
        return 'DIAMOND SAWS'
      case 'shards':
        return 'SHARD CLOUDS'
      case 'jaws':
        return 'CLOSING JAWS'
      case 'lasers':
        return 'LASER SWEEP'
      case 'wind':
        return 'WIND SHEAR'
      case 'portal_skip':
        return 'WARP PORTALS'
      default:
        return 'HAZARDS'
    }
  }

  /** How many spawns in this wave + base spacing multiplier. */
  private wavePlan(p: WavePattern): { count: number; spacing: number; coins: boolean } {
    const d = this.difficulty
    switch (p) {
      case 'ledger':
        return { count: 3 + Math.floor(d * 2), spacing: 1.05, coins: true }
      case 'ledger_highlow':
        return { count: 3 + Math.floor(d * 2), spacing: 1.0, coins: true }
      case 'spires':
        return { count: 3 + Math.floor(d * 2), spacing: 1.08, coins: true }
      case 'quantum':
        return { count: 3 + Math.floor(d), spacing: 1.0, coins: true }
      case 'float':
        return { count: 3 + Math.floor(d), spacing: 1.12, coins: false }
      case 'weave':
        return { count: 2 + Math.floor(d), spacing: 1.35, coins: true }
      case 'windows':
        return { count: 2 + Math.floor(d * 1.5), spacing: 1.2, coins: true }
      case 'chevrons':
        return { count: 3, spacing: 1.1, coins: true }
      case 'diamonds':
        return { count: 2 + Math.floor(d * 2), spacing: 1.15, coins: false }
      case 'shards':
        return { count: 2 + Math.floor(d), spacing: 1.2, coins: false }
      case 'jaws':
        return { count: 2 + Math.floor(d), spacing: 1.25, coins: true }
      case 'lasers':
        return { count: 2 + Math.floor(d * 1.5), spacing: 1.1, coins: false }
      case 'wind':
        return { count: 2, spacing: 1.15, coins: false }
      case 'portal_skip':
        // portal + forced skip target handled as 2 steps
        return { count: 2, spacing: 0.55, coins: false }
      default:
        return { count: 3, spacing: 1, coins: false }
    }
  }

  private startNextWave() {
    const unlocked = this.unlockedWavePatterns()
    this.wavePattern = unlocked[this.waveIndex % unlocked.length]
    this.waveIndex += 1
    this.waveStep = 0
    const plan = this.wavePlan(this.wavePattern)
    this.waveRemaining = plan.count

    // Brief HUD cue so waves read as progression
    this.waveLabelUntil = this.time.now + 1400
    if (this.hudHint && this.state === 'playing') {
      this.hudHint.setText(`WAVE · ${this.waveDisplayName(this.wavePattern)}`)
    }
  }

  private spawnWaveHazard(): { intervalScale: number; coins: boolean } {
    const plan = this.wavePlan(this.wavePattern)
    const p = this.wavePattern
    const step = this.waveStep

    switch (p) {
      case 'ledger':
        this.spawnLedgerPair(
          this.currentGapHeight(false),
          this.pickBias(['high', 'mid', 'low', 'random']),
        )
        break
      case 'ledger_highlow':
        // Alternate high / low so the wave has readable rhythm
        this.spawnLedgerPair(
          this.currentGapHeight(true),
          step % 2 === 0 ? 'high' : 'low',
        )
        break
      case 'spires':
        this.spawnSpires()
        break
      case 'quantum':
        this.spawnQuantumBarrier()
        break
      case 'float':
        this.spawnFloatingBlock()
        break
      case 'weave':
        this.spawnWeaveGates()
        break
      case 'windows':
        this.spawnDoubleWindows()
        break
      case 'chevrons':
        this.spawnChevrons()
        break
      case 'diamonds':
        this.spawnDiamondSaw()
        break
      case 'shards':
        this.spawnShardCloud()
        break
      case 'jaws':
        this.spawnClosingJaws()
        break
      case 'lasers':
        this.spawnLaserSweep()
        break
      case 'wind':
        this.spawnWindGust()
        break
      case 'portal_skip':
        if (step === 0) {
          this.spawnTeleportPortal()
        } else {
          // Solid target right after portal — never another special
          if (Math.random() < 0.5) this.spawnSpires()
          else
            this.spawnLedgerPair(
              this.currentGapHeight(true),
              this.pickBias(['high', 'low']),
            )
        }
        break
    }

    this.waveStep += 1
    this.waveRemaining -= 1
    return { intervalScale: plan.spacing, coins: plan.coins }
  }

  private spawnObstaclesIfNeeded() {
    if (this.time.now < this.nextSpawnAt) return
    if (this.teleporting) return

    const baseInterval = Phaser.Math.Linear(
      FALCON_FLIGHT.spawnMaxMs,
      FALCON_FLIGHT.spawnMinMs,
      this.difficulty,
    )

    // Start / advance wave when the current batch is done
    if (this.waveRemaining <= 0) {
      this.startNextWave()
    }

    const { intervalScale, coins } = this.spawnWaveHazard()

    // Coins only on clean gap waves, and only mid-wave (not cluttering specials)
    if (
      coins &&
      this.lastGapCenterY > 0 &&
      this.waveStep >= 2 &&
      this.waveRemaining >= 0 &&
      Math.random() < 0.45
    ) {
      this.spawnSafeLaneCoins(this.lastGapCenterY)
    }

    // Spacing inside a wave vs breath between waves
    const betweenWaves = this.waveRemaining <= 0
    const gapMul = betweenWaves
      ? 1.35 + (1 - this.difficulty) * 0.25
      : intervalScale

    this.nextSpawnAt =
      this.time.now +
      baseInterval * gapMul * Phaser.Math.FloatBetween(0.94, 1.06)
  }

  private pickBias(options: GateBias[]): GateBias {
    return options[Phaser.Math.Between(0, options.length - 1)]
  }

  /**
   * Choose a gap center that is playable, randomized, and often forced away
   * from the previous gate so mid-lane autopilot stops working.
   */
  private pickGapCenter(gap: number, bias: GateBias = 'random'): number {
    const { height } = this.scale
    const margin = Math.max(40, 44 * this.softH())
    const minC = margin + gap / 2
    const maxC = height - margin - gap / 2
    if (maxC <= minC) return height / 2

    let center: number
    if (bias === 'high') {
      center = Phaser.Math.FloatBetween(minC, minC + (maxC - minC) * 0.38)
    } else if (bias === 'low') {
      center = Phaser.Math.FloatBetween(minC + (maxC - minC) * 0.62, maxC)
    } else if (bias === 'mid') {
      const mid = (minC + maxC) / 2
      const wobble = (maxC - minC) * 0.12
      center = Phaser.Math.FloatBetween(mid - wobble, mid + wobble)
    } else {
      center = Phaser.Math.FloatBetween(minC, maxC)
    }

    // Avoid repeating nearly the same corridor as last set
    if (this.lastGapCenterY > 0) {
      const minShift = Math.max(gap * 0.55, height * 0.14)
      let tries = 0
      while (
        Math.abs(center - this.lastGapCenterY) < minShift &&
        tries < 8
      ) {
        center = Phaser.Math.FloatBetween(minC, maxC)
        tries += 1
      }
      // If still close, hard-nudge opposite of last
      if (Math.abs(center - this.lastGapCenterY) < minShift) {
        center =
          this.lastGapCenterY < height / 2
            ? Phaser.Math.FloatBetween(minC + (maxC - minC) * 0.55, maxC)
            : Phaser.Math.FloatBetween(minC, minC + (maxC - minC) * 0.45)
      }
    }

    this.lastGapCenterY = center
    return center
  }

  private nextSetId() {
    this.obstacleSetId += 1
    return this.obstacleSetId
  }

  private spawnLedgerPair(gapHeight: number, bias: GateBias = 'random') {
    const { width, height } = this.scale
    const x = width + 50
    const gap = gapHeight
    const gapCenter = this.pickGapCenter(gap, bias)
    const topBottom = gapCenter - gap / 2
    const bottomTop = gapCenter + gap / 2
    const blockWidth = 54
    const topHeight = Math.max(28, topBottom)
    const bottomHeight = Math.max(28, height - bottomTop)
    const setId = this.nextSetId()

    const meta: ObstacleMeta = {
      kind: 'ledger',
      scored: false,
      gapCenterY: gapCenter,
      gapHalf: gap / 2,
      setId,
    }
    const top = this.spawnScaledBlock(x, topHeight / 2, blockWidth, topHeight, 'ledger')
    const bottom = this.spawnScaledBlock(
      x,
      bottomTop + bottomHeight / 2,
      blockWidth,
      bottomHeight,
      'ledger',
    )
    top.setData('meta', meta)
    bottom.setData('meta', meta)
  }

  /** Single floating ledger — must go above or below (not a centered corridor). */
  private spawnFloatingBlock() {
    const { width, height } = this.scale
    const x = width + 50
    const s = this.softH()
    const blockH = Phaser.Math.Between(Math.round(110 * s), Math.round(190 * s))
    const blockW = 56
    const margin = Math.max(50, 56 * s)
    // Place so both passages are usable but one is usually tighter
    const minY = margin + blockH / 2
    const maxY = height - margin - blockH / 2
    let cy = Phaser.Math.FloatBetween(minY, maxY)
    // Bias away from pure center often
    if (Math.random() < 0.55) {
      cy =
        Math.random() < 0.5
          ? Phaser.Math.FloatBetween(minY, height * 0.42)
          : Phaser.Math.FloatBetween(height * 0.58, maxY)
    }
    const setId = this.nextSetId()
    const passageAbove = cy - blockH / 2
    const passageBelow = height - (cy + blockH / 2)
    const preferred =
      passageAbove > passageBelow
        ? cy - blockH / 2 - passageAbove / 2
        : cy + blockH / 2 + passageBelow / 2
    this.lastGapCenterY = preferred

    const meta: ObstacleMeta = {
      kind: 'float',
      scored: false,
      gapCenterY: preferred,
      gapHalf: Math.max(passageAbove, passageBelow) / 2,
      setId,
    }
    const block = this.spawnScaledBlock(x, cy, blockW, blockH, 'ledger')
    block.setData('meta', meta)
  }

  /** Two staggered gates — forces vertical weave between columns. */
  private spawnWeaveGates() {
    const { width } = this.scale
    const gapA = this.currentGapHeight(true)
    const gapB = this.currentGapHeight(Math.random() < 0.5)
    const biasA = this.pickBias(['high', 'low'])
    const biasB = biasA === 'high' ? 'low' : 'high'
    const spacing = Phaser.Math.Between(130, 190) * this.softH()
    const x0 = width + 50

    // First column
    this.spawnLedgerPairAt(x0, gapA, biasA)
    // Second column (offset X, opposite bias)
    this.spawnLedgerPairAt(x0 + spacing, gapB, biasB as GateBias)
  }

  private spawnLedgerPairAt(x: number, gapHeight: number, bias: GateBias) {
    const { height } = this.scale
    const gap = gapHeight
    const gapCenter = this.pickGapCenter(gap, bias)
    const topBottom = gapCenter - gap / 2
    const bottomTop = gapCenter + gap / 2
    const blockWidth = 50
    const topHeight = Math.max(28, topBottom)
    const bottomHeight = Math.max(28, height - bottomTop)
    const setId = this.nextSetId()
    const meta: ObstacleMeta = {
      kind: 'weave',
      scored: false,
      gapCenterY: gapCenter,
      gapHalf: gap / 2,
      setId,
    }
    const top = this.spawnScaledBlock(x, topHeight / 2, blockWidth, topHeight, 'ledger')
    const bottom = this.spawnScaledBlock(
      x,
      bottomTop + bottomHeight / 2,
      blockWidth,
      bottomHeight,
      'ledger',
    )
    top.setData('meta', meta)
    bottom.setData('meta', meta)
  }

  private spawnQuantumBarrier() {
    const { width, height } = this.scale
    const x = width + 40
    const slotH = this.currentGapHeight(true) * 0.95
    const slotCenter = this.pickGapCenter(slotH, this.pickBias(['high', 'low', 'random']))
    const barW = 26
    const topH = Math.max(22, slotCenter - slotH / 2)
    const botY = slotCenter + slotH / 2
    const botH = Math.max(22, height - botY)
    const setId = this.nextSetId()
    const meta: ObstacleMeta = {
      kind: 'quantum',
      scored: false,
      gapCenterY: slotCenter,
      gapHalf: slotH / 2,
      setId,
    }
    for (const seg of [
      { y: topH / 2, h: topH },
      { y: botY + botH / 2, h: botH },
    ]) {
      const bar = this.spawnTex(x, seg.y, barW, seg.h, 'quantum-bar', 0.88, 0.94)
      bar.setData('meta', meta)
      attachQuantumPulse(this, bar)
    }
  }

  /**
   * Crystal spires: stalactites + stalagmites with a gap to thread.
   * Reads as spikes, not boxes.
   */
  private spawnSpires() {
    const { width, height } = this.scale
    const x = width + 48
    const s = this.softH()
    const gap = this.currentGapHeight(true)
    const gapCenter = this.pickGapCenter(gap, this.pickBias(['high', 'low', 'random']))
    const topTip = gapCenter - gap / 2
    const botTip = gapCenter + gap / 2
    const setId = this.nextSetId()
    const meta: ObstacleMeta = {
      kind: 'spires',
      scored: false,
      gapCenterY: gapCenter,
      gapHalf: gap / 2,
      setId,
    }

    // Hanging spire from ceiling (point down) — height reaches gap top
    const hangH = Math.max(48 * s, topTip)
    const hang = this.spawnTex(
      x,
      hangH / 2,
      44 * s,
      hangH,
      'flight-spire-down',
      0.55,
      0.88,
    )
    hang.setData('meta', meta)

    // Rising spire from floor (point up)
    const riseH = Math.max(48 * s, height - botTip)
    const rise = this.spawnTex(
      x + Phaser.Math.Between(-8, 8),
      height - riseH / 2,
      44 * s,
      riseH,
      'flight-spire-up',
      0.55,
      0.88,
    )
    rise.setData('meta', meta)

    // Optional second floor spike offset for jagged look
    if (Math.random() < 0.45 + this.difficulty * 0.2) {
      const h2 = riseH * Phaser.Math.FloatBetween(0.45, 0.7)
      const side = this.spawnTex(
        x + 36 * s,
        height - h2 / 2,
        36 * s,
        h2,
        'flight-spire-up',
        0.55,
        0.88,
      )
      side.setData('meta', meta)
    }
  }

  /**
   * Bobbing diamond “saws” — vertical sine motion, fly above or below.
   */
  private spawnDiamondSaw() {
    const { width, height } = this.scale
    const x = width + 50
    const s = this.softH()
    const size = Phaser.Math.Between(Math.round(48 * s), Math.round(72 * s))
    const margin = 50 * s + size / 2
    const baseY = Phaser.Math.FloatBetween(margin, height - margin)
    // Prefer off-center so mid-lane is risky
    const amp = Phaser.Math.Between(Math.round(40 * s), Math.round(90 * s))
    const setId = this.nextSetId()
    const meta: ObstacleMeta = {
      kind: 'diamond',
      scored: false,
      gapCenterY: baseY < height / 2 ? baseY + size : baseY - size,
      gapHalf: size,
      setId,
      motion: 'sineY',
      baseY,
      amp,
      phase: Math.random() * Math.PI * 2,
      bobSpeed: 2.2 + this.difficulty * 1.4,
    }
    const d = this.spawnTex(x, baseY, size, size, 'flight-diamond', 0.7, 0.7)
    d.setData('meta', meta)
    attachQuantumPulse(this, d)

    // Sometimes a second diamond offset in X/Y for a pair
    if (Math.random() < 0.4 + this.difficulty * 0.25) {
      const baseY2 = Phaser.Math.Clamp(
        baseY + (Math.random() < 0.5 ? 1 : -1) * (size + 50 * s),
        margin,
        height - margin,
      )
      const meta2: ObstacleMeta = {
        ...meta,
        setId: this.nextSetId(),
        scored: false,
        baseY: baseY2,
        phase: (meta.phase ?? 0) + 1.2,
        gapCenterY: (baseY + baseY2) / 2,
      }
      const d2 = this.spawnTex(
        x + 70 * s,
        baseY2,
        size * 0.85,
        size * 0.85,
        'flight-diamond',
        0.7,
        0.7,
      )
      d2.setData('meta', meta2)
      attachQuantumPulse(this, d2)
    }
  }

  /**
   * Quantum shard cloud — loose triangle cluster; weave through soft openings.
   */
  private spawnShardCloud() {
    const { width, height } = this.scale
    const x0 = width + 40
    const s = this.softH()
    const setId = this.nextSetId()
    const lane = this.pickGapCenter(height * 0.25, this.pickBias(['high', 'low', 'mid']))
    const meta: ObstacleMeta = {
      kind: 'shards',
      scored: false,
      gapCenterY: lane,
      gapHalf: 50 * s,
      setId,
    }
    const count = 4 + Math.floor(this.difficulty * 3)
    for (let i = 0; i < count; i++) {
      const sx = x0 + i * 22 * s + Phaser.Math.Between(-6, 10)
      // Leave a soft corridor around `lane`
      let sy = Phaser.Math.FloatBetween(40 * s, height - 40 * s)
      if (Math.abs(sy - lane) < 42 * s) {
        sy = lane + (sy < lane ? -55 * s : 55 * s)
      }
      const sh = Phaser.Math.Between(Math.round(28 * s), Math.round(44 * s))
      const shard = this.spawnTex(sx, sy, sh * 0.75, sh, 'flight-shard', 0.65, 0.75)
      shard.setAngle(Phaser.Math.Between(-25, 25))
      shard.setData('meta', meta)
      if (Math.random() < 0.5) attachQuantumPulse(this, shard)
    }
  }

  /**
   * Double windows: three slabs = two tunnels (pick high or low path).
   */
  private spawnDoubleWindows() {
    const { width, height } = this.scale
    const x = width + 50
    const s = this.softH()
    const gap = this.currentGapHeight(true) * 0.85
    // [ceiling slab][gap][middle floating][gap][floor slab]
    const y1 = Math.max(28, Phaser.Math.FloatBetween(height * 0.08, height * 0.22))
    const gap1 = Math.max(gap * 0.9, 70 * s)
    const midTop = y1 + gap1
    const midH2 = Phaser.Math.Between(Math.round(70 * s), Math.round(120 * s))
    const midBot = midTop + midH2
    const gap2 = Math.max(gap * 0.9, 70 * s)
    const floorTop = Math.min(height - 28, midBot + gap2)

    const setId = this.nextSetId()
    const preferred =
      Math.random() < 0.5 ? y1 + gap1 / 2 : midBot + (floorTop - midBot) / 2
    this.lastGapCenterY = preferred
    const meta: ObstacleMeta = {
      kind: 'windows',
      scored: false,
      gapCenterY: preferred,
      gapHalf: Math.min(gap1, gap2) / 2,
      setId,
    }

    const w = 50
    const top = this.spawnTex(x, y1 / 2, w, y1, 'ledger-block')
    const mid = this.spawnTex(x, (midTop + midBot) / 2, w + 6, midH2, 'quantum-bar')
    const botH = height - floorTop
    const bot = this.spawnTex(x, floorTop + botH / 2, w, botH, 'ledger-block')
    top.setData('meta', meta)
    mid.setData('meta', meta)
    bot.setData('meta', meta)
    attachQuantumPulse(this, mid)
  }

  /**
   * Paired chevrons — arrow wedges stacked with a gap (reads as speed gates).
   */
  private spawnChevrons() {
    const { width, height } = this.scale
    const x = width + 48
    const s = this.softH()
    const gap = this.currentGapHeight(false)
    const gapCenter = this.pickGapCenter(gap, this.pickBias(['high', 'low', 'random']))
    const setId = this.nextSetId()
    const meta: ObstacleMeta = {
      kind: 'chevrons',
      scored: false,
      gapCenterY: gapCenter,
      gapHalf: gap / 2,
      setId,
    }
    const chW = 50 * s
    const chH = 42 * s
    // Stack chevrons above and below the gap
    let y = gapCenter - gap / 2 - chH / 2
    while (y > chH * 0.4) {
      const c = this.spawnTex(x, y, chW, chH, 'flight-chevron', 0.8, 0.8)
      c.setData('meta', meta)
      y -= chH * 0.85
    }
    y = gapCenter + gap / 2 + chH / 2
    while (y < height - chH * 0.4) {
      const c = this.spawnTex(x, y, chW, chH, 'flight-chevron', 0.8, 0.8)
      c.setData('meta', meta)
      y += chH * 0.85
    }
  }

  /**
   * Gold/cyan ring portal — fly the core to blink past the next hazard.
   * Rim top/bottom still kill if you clip them.
   */
  private spawnTeleportPortal() {
    const { width, height } = this.scale
    const x = width + 56
    const s = this.softH()
    const hole = Math.max(this.currentGapHeight(false) * 0.95, 88 * s)
    const cy = this.pickGapCenter(hole, this.pickBias(['high', 'mid', 'low', 'random']))
    const setId = this.nextSetId()

    // Deadly rim slabs (leave a circular-feeling hole)
    const topH = Math.max(24, cy - hole / 2)
    const botY = cy + hole / 2
    const botH = Math.max(24, height - botY)
    const rimMeta: ObstacleMeta = {
      kind: 'portal',
      scored: false,
      gapCenterY: cy,
      gapHalf: hole / 2,
      setId,
    }
    const top = this.spawnTex(x, topH / 2, 40, topH, 'quantum-bar', 0.85, 0.92)
    const bot = this.spawnTex(x, botY + botH / 2, 40, botH, 'quantum-bar', 0.85, 0.92)
    top.setData('meta', rimMeta)
    bot.setData('meta', rimMeta)
    attachQuantumPulse(this, top)
    attachQuantumPulse(this, bot)

    // Visual ring + teleport trigger (safe)
    const ringSize = hole * 0.95
    const ring = this.spawnTex(x, cy, ringSize, ringSize, 'flight-portal', 0.35, 0.35)
    const ringMeta: ObstacleMeta = {
      kind: 'portal',
      scored: false,
      noDamage: true,
      gapCenterY: cy,
      gapHalf: hole / 2,
      setId,
    }
    ring.setData('meta', ringMeta)
    ring.setDepth(6)
    attachQuantumPulse(this, ring)

    const core = this.spawnTex(x, cy, hole * 0.42, hole * 0.42, 'flight-portal', 0.9, 0.9)
    core.setAlpha(0.35)
    core.setData('meta', {
      kind: 'portal',
      scored: false,
      noDamage: true,
      isPortal: true,
      gapCenterY: cy,
      gapHalf: hole / 2,
      setId,
    } satisfies ObstacleMeta)
    core.setDepth(7)
  }

  /** Horizontal laser that sweeps vertically and pulses on/off. */
  private spawnLaserSweep() {
    const { width, height } = this.scale
    const x = width + 60
    const s = this.softH()
    const barW = Math.min(width * 0.55, 200 * s)
    const barH = 12 * s
    const margin = 50 * s
    const baseY = Phaser.Math.FloatBetween(margin, height - margin)
    const amp = Phaser.Math.Between(Math.round(50 * s), Math.round(110 * s))
    const setId = this.nextSetId()
    const meta: ObstacleMeta = {
      kind: 'laser',
      scored: false,
      gapCenterY: baseY,
      gapHalf: 40,
      setId,
      motion: 'laser',
      baseY,
      amp,
      phase: Math.random() * Math.PI * 2,
      bobSpeed: 1.6 + this.difficulty * 1.2,
      laserActive: true,
    }
    const laser = this.spawnTex(x, baseY, barW, barH, 'flight-laser', 0.92, 0.75)
    laser.setData('meta', meta)
    laser.setDepth(6)
  }

  /** Ledger jaws that close as they approach — gap shrinks over time. */
  private spawnClosingJaws() {
    const { width, height } = this.scale
    const x = width + 50
    const gapStart = this.currentGapHeight(false) * 1.05
    const gapMin = Math.max(
      FALCON_FLIGHT.gapFloorPx * this.softH() + FALCON_FLIGHT.playerRadius * 2 + 20,
      gapStart * 0.42,
    )
    const gapCenter = this.pickGapCenter(gapStart, this.pickBias(['high', 'low', 'mid']))
    const setId = this.nextSetId()
    const topBottom = gapCenter - gapStart / 2
    const bottomTop = gapCenter + gapStart / 2
    const blockW = 56
    const topH = Math.max(28, topBottom)
    const botH = Math.max(28, height - bottomTop)

    const shared = {
      kind: 'jaws' as const,
      scored: false,
      gapCenterY: gapCenter,
      gapHalf: gapStart / 2,
      setId,
      motion: 'jaws' as const,
      gapStart,
      gapMin,
      closeRate: 0.22 + this.difficulty * 0.28,
      jawProgress: 0,
    }

    const top = this.spawnTex(x, topH / 2, blockW, topH, 'ledger-block')
    const bot = this.spawnTex(x, bottomTop + botH / 2, blockW, botH, 'ledger-block')
    top.setData('meta', { ...shared, jawRole: 'top' } satisfies ObstacleMeta)
    bot.setData('meta', { ...shared, jawRole: 'bot' } satisfies ObstacleMeta)
    top.setTint(0xf87171)
    bot.setTint(0xf87171)
  }

  /** Non-lethal wind column that shoves the falcon up or down. */
  private spawnWindGust() {
    const { width, height } = this.scale
    const x = width + 50
    const s = this.softH()
    const w = 70 * s
    const h = height * Phaser.Math.FloatBetween(0.45, 0.75)
    const y = Phaser.Math.FloatBetween(h / 2 + 20, height - h / 2 - 20)
    const force = Math.random() < 0.5 ? 1 : -1
    const setId = this.nextSetId()
    const meta: ObstacleMeta = {
      kind: 'wind',
      scored: false,
      noDamage: true,
      isWind: true,
      windForce: force,
      gapCenterY: y,
      gapHalf: h / 2,
      setId,
    }
    const gust = this.spawnTex(x, y, w, h, 'flight-wind', 0.95, 0.95)
    gust.setData('meta', meta)
    gust.setAlpha(0.55)
    gust.setFlipY(force < 0)
    this.lastGapCenterY = y
  }

  /** Gold coins along a safe lane (collect, no damage). */
  private spawnSafeLaneCoins(laneY: number) {
    const { width } = this.scale
    const s = this.softH()
    const x0 = width + 30
    const setId = this.nextSetId()
    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const coin = this.spawnTex(
        x0 + i * 36 * s,
        laneY + Math.sin(i * 1.2) * 10 * s,
        18 * s,
        18 * s,
        'flight-coin',
        0.7,
        0.7,
      )
      coin.setData('meta', {
        kind: 'coin',
        scored: false,
        noDamage: true,
        coinValue: 3,
        gapCenterY: laneY,
        gapHalf: 20,
        setId,
      } satisfies ObstacleMeta)
      coin.setDepth(6)
    }
  }

  private spawnScaledBlock(
    x: number,
    y: number,
    w: number,
    h: number,
    kind: ObstacleKind,
  ) {
    const key: ObstacleTex =
      kind === 'quantum' ? 'quantum-bar' : 'ledger-block'
    return this.spawnTex(x, y, w, h, key)
  }

  private spawnTex(
    x: number,
    y: number,
    w: number,
    h: number,
    key: ObstacleTex,
    hitScaleX = 0.88,
    hitScaleY = 0.94,
  ) {
    const block = this.obstacles.create(x, y, key) as Phaser.Physics.Arcade.Image
    this.fitObstacleBody(block, w, h, hitScaleX, hitScaleY)
    block.setImmovable(true)
    block.setDepth(5)
    return block
  }

  private fitObstacleBody(
    obj: Phaser.Physics.Arcade.Image,
    displayW: number,
    displayH: number,
    hitScaleX = 0.88,
    hitScaleY = 0.94,
  ) {
    obj.setDisplaySize(displayW, displayH)
    const body = obj.body as Phaser.Physics.Arcade.Body
    const frameW = obj.frame.width
    const frameH = obj.frame.height
    const sourceW = frameW * hitScaleX
    const sourceH = frameH * hitScaleY
    body.setSize(sourceW, sourceH)
    body.setOffset((frameW - sourceW) / 2, (frameH - sourceH) / 2)
    body.updateFromGameObject()
  }

  private shouldProcessObstacle(obs: Phaser.Physics.Arcade.Image): boolean {
    if (this.teleporting) return false
    if (this.time.now < this.invulnUntil) return false
    if (this.state !== 'playing' || this.paused) return false
    const meta = obs.getData('meta') as ObstacleMeta | undefined
    if (!meta) return true
    if (meta.kind === 'laser' && meta.laserActive === false) return false
    return true
  }

  private onObstacleOverlap(obs: Phaser.Physics.Arcade.Image) {
    const meta = obs.getData('meta') as ObstacleMeta | undefined
    if (!meta) {
      this.handleCrash()
      return
    }
    if (meta.noDamage) {
      if (meta.isPortal && !meta.used) {
        this.triggerPortalTeleport(obs, meta)
      } else if (meta.kind === 'coin' && !meta.scored) {
        meta.scored = true
        this.addScore(meta.coinValue ?? 3)
        floatScoreText(this, obs.x, obs.y - 12, `+${meta.coinValue ?? 3}`, '#f0c14a')
        obs.destroy()
      }
      // wind applied continuously in updateObstacles
      return
    }
    this.handleCrash()
  }

  /**
   * Vanish → clear through the next solid hazard → reappear beyond it.
   */
  private triggerPortalTeleport(
    portal: Phaser.Physics.Arcade.Image,
    meta: ObstacleMeta,
  ) {
    if (this.teleporting || this.state !== 'playing') return
    meta.used = true
    meta.scored = true

    // Next damaging obstacle ahead of this portal
    let nextX: number | null = null
    let nextSet: number | undefined
    for (const o of this.obstacles.getChildren() as Phaser.Physics.Arcade.Image[]) {
      const m = o.getData('meta') as ObstacleMeta | undefined
      if (!m || m.noDamage) continue
      if (o.x <= portal.x + 20) continue
      if (nextX === null || o.x < nextX) {
        nextX = o.x
        nextSet = m.setId
      }
    }

    // Clear through that set (or a fixed skip if nothing ahead yet)
    let clearUntil = portal.x + 320
    if (nextX != null) {
      clearUntil = nextX + 100
      if (nextSet != null) {
        for (const o of this.obstacles.getChildren() as Phaser.Physics.Arcade.Image[]) {
          const m = o.getData('meta') as ObstacleMeta | undefined
          if (m?.setId === nextSet) {
            clearUntil = Math.max(clearUntil, o.x + o.displayWidth / 2 + 40)
          }
        }
      }
    }

    this.teleporting = true
    this.invulnUntil = this.time.now + 1200
    stopTrail(this.trail)
    this.falcon.setVelocity(0, 0)
    this.falconVisual.setAlpha(0)
    this.falcon.setAlpha(0)
    floatScoreText(this, this.falcon.x, this.falcon.y - 36, 'WARP', '#22d3ee', {
      fontSize: '18px',
    })
    this.cameras.main.flash(120, 34, 211, 238, false)
    this.addScore(Math.round(FALCON_FLIGHT.gapPassBonus * 1.5))

    const destY = meta.gapCenterY ?? this.falcon.y
    const clearX = clearUntil

    this.time.delayedCall(200, () => {
      if (this.state !== 'playing') {
        this.teleporting = false
        return
      }
      // Wipe hazards from ship through the skipped obstacle
      for (const o of [
        ...this.obstacles.getChildren(),
      ] as Phaser.Physics.Arcade.Image[]) {
        if (o.x < clearX + 10) {
          const m = o.getData('meta') as ObstacleMeta | undefined
          if (m && !m.scored && !m.noDamage) m.scored = true
          o.destroy()
        }
      }
      this.falcon.y = Phaser.Math.Clamp(
        destY,
        40,
        this.scale.height - 40,
      )
      this.falconVisual.y = this.falcon.y
      this.falconVisual.setAlpha(1)
      this.falcon.setAlpha(1)
      this.teleporting = false
      startTrail(this.trail, this.falcon)
      floatScoreText(
        this,
        this.falcon.x + 20,
        this.falcon.y - 28,
        'RE-ENTRY',
        '#d4922a',
      )
      nearMissSpark(this, this.sparkEmitter, this.falcon.x, this.falcon.y)
    })
  }

  private updateObstacles(delta: number) {
    const dx = this.scrollSpeed * (delta / 1000)
    const t = this.time.now / 1000
    const children = this.obstacles.getChildren() as Phaser.Physics.Arcade.Image[]
    const dt = delta / 1000

    // Closing jaws share progress per setId
    const jawProgress = new Map<number, number>()

    for (const obs of children) {
      obs.x -= dx

      const meta = obs.getData('meta') as ObstacleMeta | undefined
      if (!meta) continue

      // Vertical bob for diamonds
      if (meta.motion === 'sineY' && meta.baseY != null && meta.amp != null) {
        const spd = meta.bobSpeed ?? 2.4
        const phase = meta.phase ?? 0
        obs.y = meta.baseY + Math.sin(t * spd + phase) * meta.amp
        if (meta.kind === 'diamond') {
          obs.angle += dt * (40 + this.difficulty * 30)
        }
      }

      // Laser sweep + pulse on/off
      if (meta.motion === 'laser' && meta.baseY != null && meta.amp != null) {
        const spd = meta.bobSpeed ?? 2
        const phase = meta.phase ?? 0
        obs.y = meta.baseY + Math.sin(t * spd + phase) * meta.amp
        const wave = Math.sin(t * (2.4 + this.difficulty) + phase)
        meta.laserActive = wave > -0.15
        obs.setAlpha(meta.laserActive ? 0.95 : 0.18)
        obs.setVisible(true)
      }

      // Closing jaws
      if (meta.motion === 'jaws' && meta.gapStart != null && meta.gapMin != null) {
        const id = meta.setId ?? 0
        if (!jawProgress.has(id)) {
          const p = Math.min(
            1,
            (meta.jawProgress ?? 0) + dt * (meta.closeRate ?? 0.3),
          )
          jawProgress.set(id, p)
        }
        const p = jawProgress.get(id) ?? 0
        meta.jawProgress = p
        const gap = Phaser.Math.Linear(meta.gapStart, meta.gapMin, p)
        meta.gapHalf = gap / 2
        const cy = meta.gapCenterY ?? this.scale.height / 2
        const { height } = this.scale
        if (meta.jawRole === 'top') {
          const topH = Math.max(24, cy - gap / 2)
          obs.setDisplaySize(obs.displayWidth, topH)
          obs.y = topH / 2
          this.fitObstacleBody(obs, obs.displayWidth, topH, 0.88, 0.94)
        } else if (meta.jawRole === 'bot') {
          const botTop = cy + gap / 2
          const botH = Math.max(24, height - botTop)
          obs.setDisplaySize(obs.displayWidth, botH)
          obs.y = botTop + botH / 2
          this.fitObstacleBody(obs, obs.displayWidth, botH, 0.88, 0.94)
        }
      }

      // Wind shove while overlapping
      if (
        meta.isWind &&
        meta.windForce &&
        this.state === 'playing' &&
        !this.teleporting &&
        this.time.now >= this.invulnUntil
      ) {
        const halfW = obs.displayWidth / 2
        const halfH = obs.displayHeight / 2
        if (
          Math.abs(this.falcon.x - obs.x) < halfW + 12 &&
          Math.abs(this.falcon.y - obs.y) < halfH + 12
        ) {
          this.falcon.y += meta.windForce * 220 * dt
          this.falcon.y = Phaser.Math.Clamp(
            this.falcon.y,
            28,
            this.scale.height - 28,
          )
        }
      }

      // Coins spin
      if (meta.kind === 'coin') {
        obs.angle += dt * 90
      }

      const body = obs.body as Phaser.Physics.Arcade.Body | null
      if (body) {
        body.x = obs.x - body.halfWidth
        body.y = obs.y - body.halfHeight
      }

      if (meta.scored || meta.noDamage) continue

      if (obs.x + obs.displayWidth / 2 < this.falcon.x - 8) {
        meta.scored = true
        const bonus = FALCON_FLIGHT.gapPassBonus
        this.addScore(bonus)

        const gapCenter = meta.gapCenterY ?? this.falcon.y
        const gapHalf = meta.gapHalf ?? 80
        const edgeDist = Math.abs(this.falcon.y - gapCenter)
        const nearMiss = edgeDist > gapHalf * 0.62

        if (nearMiss) {
          nearMissSpark(this, this.sparkEmitter, this.falcon.x + 20, this.falcon.y)
          floatScoreText(this, this.falcon.x + 24, this.falcon.y - 18, 'CLOSE!', '#22d3ee')
        } else {
          flashCleanPass(this)
          floatScoreText(
            this,
            this.falcon.x + 28,
            this.falcon.y - 20,
            `+${bonus} CLEAN`,
            '#d4922a',
          )
        }
      }
    }
  }

  private cullObstacles() {
    for (const obs of this.obstacles.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (obs.x < -80) obs.destroy()
    }
  }

  private getBridge(): FalconFlightBridge | null {
    return (
      (this.game.registry.get('falconFlightBridge') as FalconFlightBridge | undefined) ??
      null
    )
  }

  private emitScore(score: number) {
    this.getBridge()?.onScoreChange(score)
  }

  private emitState(state: FalconFlightGameState) {
    this.getBridge()?.onStateChange(state)
  }
}
