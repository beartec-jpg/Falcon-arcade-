import Phaser from 'phaser'
import {
  animateRunnerEmblem,
  createRunnerEmblem,
  type CharacterMood,
  type RunnerEmblem,
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
  LEDGER_RUNNER,
  LEDGER_RUNNER_REWARD_THRESHOLD,
  LEDGER_RUNNER_SLUG,
  RUNNER_COLORS,
  type LedgerRunnerBridge,
  type LedgerRunnerGameState,
} from './ledgerRunnerConfig'

type HazardKind =
  | 'spike'
  | 'barrier'
  | 'floater'
  | 'lowbeam'
  | 'powerup'
  | 'platform'
  | 'pit'

/** One family per wave — unlocks with difficulty (Flight-style). */
type RunnerWavePattern =
  | 'spikes'
  | 'floaters'
  | 'slide_beams'
  | 'barriers'
  | 'pits_small'
  | 'pits_wide'
  | 'powerups'
  | 'runway'
  | 'spike_beam'

type HazardMeta = {
  kind: HazardKind
  scored: boolean
  /** Vertical band the runner must avoid (for perfect-clear checks). */
  dangerTop: number
  dangerBottom: number
  /** ground hazards ignored while on elevated runway */
  lane?: 'ground' | 'high' | 'any'
  /** True if standing cannot clear — must slide (or be on high platform). */
  requiresSlide?: boolean
  noDamage?: boolean
  isPowerup?: boolean
  isPlatform?: boolean
  platformTop?: number
  platformLeft?: number
  platformRight?: number
  /** Floor hole — runner falls if not jumping across */
  isPit?: boolean
  pitLeft?: number
  pitRight?: number
  /** Wide pits need a double-jump to clear at normal speeds */
  needsDoubleJump?: boolean
}

/**
 * Ledger Runner — horizontal auto-runner.
 * Auto-scrolls forward; player jumps (and optional double-jump / slide).
 */
export class LedgerRunnerScene extends Phaser.Scene {
  private state: LedgerRunnerGameState = 'ready'
  private paused = false
  private waitingHowTo = false
  private score = 0
  private bestScore = 0
  private combo = 0
  private distanceAccumulator = 0
  private scrollSpeed: number = LEDGER_RUNNER.baseScrollSpeed
  private difficulty = 0
  private nextSpawnAt = 0
  private elapsedPlayMs = 0
  private streamScroll = 0

  private player!: Phaser.Physics.Arcade.Image
  private playerVisual!: Phaser.GameObjects.Container
  private runnerEmblem!: RunnerEmblem
  private hazards!: Phaser.Physics.Arcade.Group
  private groundY: number = LEDGER_RUNNER.groundY

  private jumpsRemaining = 2
  private isSliding = false
  private slideUntil = 0
  private onGround = false

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyW!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyUp!: Phaser.Input.Keyboard.Key
  private keyDown!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private keyZ!: Phaser.Input.Keyboard.Key
  private keyP!: Phaser.Input.Keyboard.Key

  private starLayers: StarLayer[] = []
  private nebula!: NebulaBackdrop
  private dataStream!: Phaser.GameObjects.Graphics
  private groundGfx!: Phaser.GameObjects.Graphics
  private groundScroll = 0
  private touchUi!: TouchZonePair
  private zonesFaded = false

  private hudScore!: Phaser.GameObjects.Text
  private hudCombo!: Phaser.GameObjects.Text
  private hudHint!: Phaser.GameObjects.Text
  private pauseDim!: Phaser.GameObjects.Rectangle
  private pauseLabel!: Phaser.GameObjects.Text
  private newBestBanner!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Container
  private deathEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter
  private runBob = 0
  /** Cancelled on restart so "Ledger Halted" cannot stick mid-run. */
  private gameOverTimer?: Phaser.Time.TimerEvent
  /** Brief spawn protection after launch / restart. */
  private invulnUntil = 0
  /**
   * Jump press buffer (ms). JustDown is one frame; buffer holds the request
   * until landing / coyote allows it.
   */
  private jumpBufferUntil = 0
  /** Coyote time: still allow a ground jump shortly after leaving the floor. */
  private coyoteUntil = 0
  private wasOnGround = true
  /** Ignore slide for a moment after a jump so fat-finger floor taps don’t slide. */
  private slideLockUntil = 0
  /**
   * After a successful jump, ground logic must not zero velocityY for a short
   * window — feet are still on the floor for 1–2 frames and were eating hops.
   */
  private jumpBoostUntil = 0
  /** Mario-style power: one free hit, then shrink. */
  private powered = false
  /** Currently standing on elevated runway. */
  private onPlatform = false
  private activePlatformTop = 0

  // ── Wave director (gradual like Flight) ────────────────
  private waveIndex = 0
  private waveRemaining = 0
  private waveStep = 0
  private wavePattern: RunnerWavePattern = 'spikes'
  private waveLabelUntil = 0

  constructor() {
    super('LedgerRunnerScene')
  }

  /** Scale design-time values to the live playfield height. */
  private hScale() {
    return this.scale.height / LEDGER_RUNNER.designHeight
  }

  private softH() {
    return Phaser.Math.Clamp(this.hScale(), 0.95, 1.2)
  }

  private standH() {
    return (
      LEDGER_RUNNER.playerH *
      (this.powered ? LEDGER_RUNNER.powerScale : 1)
    )
  }

  /** Effective floor under the runner (ground or elevated runway). */
  private floorY() {
    return this.onPlatform ? this.activePlatformTop : this.groundY
  }

  create() {
    const { width, height } = this.scale
    // Keep ground near the bottom of whatever aspect we're using
    this.groundY = height * (LEDGER_RUNNER.groundY / LEDGER_RUNNER.designHeight)

    this.cameras.main.setBackgroundColor(RUNNER_COLORS.bgHex)
    // Scale gravity with height so jump arcs feel the same on tall screens
    this.physics.world.gravity.y = LEDGER_RUNNER.gravityY * this.hScale()
    this.physics.world.setBounds(0, 0, width, height)
    ensureJuiceTextures(this)

    this.nebula = createNebulaBackdrop(this, width, height, 0)
    this.starLayers = createParallaxStarfield(this, width, this.groundY)
    this.dataStream = createDataStream(this, 1)
    this.createGround(width)
    this.createTextures()

    this.hazards = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    })

    this.trail = createPlayerTrail(this, 9)
    this.runnerEmblem = createRunnerEmblem(
      this,
      LEDGER_RUNNER.playerX,
      this.groundY - LEDGER_RUNNER.playerH / 2,
      11,
    )
    this.playerVisual = this.runnerEmblem.root
    this.player = this.physics.add.image(
      LEDGER_RUNNER.playerX,
      this.groundY - LEDGER_RUNNER.playerH / 2,
      'runner-hitbox',
    )
    this.player.setVisible(false)
    this.player.setCollideWorldBounds(true)
    this.player.setBounce(0)
    this.player.setDepth(10)
    this.setStandingBody()

    this.physics.add.overlap(
      this.player,
      this.hazards,
      (_p, h) => this.onHazardOverlap(h as Phaser.Physics.Arcade.Image),
      (_p, h) => this.shouldProcessHazard(h as Phaser.Physics.Arcade.Image),
      this,
    )

    this.touchUi = createTouchAffordances(this, 'vertical')
    // Most of screen = jump · thin bottom edge = slide
    this.touchUi.labelA.setText('TAP JUMP')
    this.touchUi.labelB.setText('BOTTOM SLIDE')

    this.setupInput()
    this.createHud(width, height)
    this.deathEmitter = createDeathEmitter(this)
    this.sparkEmitter = createSparkEmitter(this)
    this.resetRun()

    if (!hasSeenHowTo(LEDGER_RUNNER_SLUG)) {
      this.waitingHowTo = true
      createHowToOverlay(
        this,
        'Ledger Runner',
        [
          'You run automatically.',
          'Jump spikes & floor pits · slide under LOW beams.',
          'Wide pits need double-jump · SUPER = free hit · runways skip ground hazards.',
          `Chain cleans for combos. Claim at ${LEDGER_RUNNER_REWARD_THRESHOLD}.`,
        ],
        () => {
          markHowToSeen(LEDGER_RUNNER_SLUG)
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
      this.state === 'playing' && !this.paused ? this.scrollSpeed : 40
    updateParallaxStarfield(
      this.starLayers,
      this.scale.width,
      this.groundY,
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
    this.streamScroll += scrollRef * (delta / 1000) * 0.4
    drawDataStream(
      this.dataStream,
      this.scale.width,
      this.groundY,
      this.streamScroll,
      'horizontal',
    )
    this.drawGround(delta)

    if (this.waitingHowTo) {
      this.syncPlayerVisual(delta)
      return
    }

    if (
      this.keyP &&
      Phaser.Input.Keyboard.JustDown(this.keyP) &&
      this.state === 'playing'
    ) {
      this.togglePause()
    }
    if (this.paused) {
      this.syncPlayerVisual(delta)
      return
    }

    if (this.state === 'ready') {
      this.idleBob(delta)
      if (this.consumeJumpPress() || this.consumeStartPress()) {
        this.beginRun()
      }
      this.syncPlayerVisual(delta)
      return
    }

    if (this.state === 'gameover') {
      if (this.consumeJumpPress() || this.consumeStartPress()) {
        this.resetRun()
        this.beginRun()
      }
      this.syncPlayerVisual(delta)
      return
    }

    // playing — resolve jump *before* ground stick so we never zero a fresh hop
    this.elapsedPlayMs += delta
    this.difficulty = Phaser.Math.Clamp(
      this.elapsedPlayMs / (LEDGER_RUNNER.difficultyRampSeconds * 1000),
      0,
      1,
    )
    this.scrollSpeed = Phaser.Math.Linear(
      LEDGER_RUNNER.baseScrollSpeed,
      LEDGER_RUNNER.maxScrollSpeed,
      this.difficulty,
    )

    if (this.consumeJumpPress()) {
      this.requestJump()
    }
    this.tryConsumeJumpBuffer()

    this.handleSlideInput()

    if (this.isSliding && this.time.now >= this.slideUntil) {
      this.endSlide()
    }

    this.updateGrounded()

    // Lock X; runner stays put while world scrolls.
    this.player.x = LEDGER_RUNNER.playerX
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.x = this.player.x - body.halfWidth

    this.syncPlayerVisual(delta)
    this.advanceScore(delta)
    this.spawnHazardsIfNeeded()
    this.updateHazards(delta)
    this.cullHazards()

    if (
      this.waveLabelUntil > 0 &&
      this.time.now > this.waveLabelUntil &&
      this.state === 'playing'
    ) {
      this.waveLabelUntil = 0
      this.hudHint.setText(
        'Jump pits · slide beams · SUPER · double-jump runways/wide pits',
      )
    }
  }

  // ── setup ──────────────────────────────────────────────

  private createTextures() {
    if (!this.textures.exists('runner-hitbox')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 32, 48)
      g.generateTexture('runner-hitbox', 32, 48)
      g.destroy()
    }

    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 1)
      g.fillCircle(4, 4, 4)
      g.generateTexture('spark', 8, 8)
      g.destroy()
    }

    if (!this.textures.exists('spike')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 40
      const h = 36
      g.fillStyle(RUNNER_COLORS.quantumDim, 1)
      g.fillTriangle(0, h, w / 2, 0, w, h)
      g.lineStyle(2, RUNNER_COLORS.quantum, 0.95)
      g.strokeTriangle(0, h, w / 2, 0, w, h)
      // base plate
      g.fillStyle(RUNNER_COLORS.bronzeDark, 0.9)
      g.fillRect(2, h - 6, w - 4, 6)
      g.generateTexture('spike', w, h)
      g.destroy()
    }

    if (!this.textures.exists('barrier')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 48
      const h = 120
      g.fillStyle(RUNNER_COLORS.ledgerFace, 1)
      g.fillRoundedRect(0, 0, w, h, 6)
      g.lineStyle(2, RUNNER_COLORS.bronze, 0.9)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 6)
      g.lineStyle(1, RUNNER_COLORS.bronzeDark, 0.55)
      for (let y = 16; y < h - 10; y += 14) {
        g.lineBetween(8, y, w - 8, y)
      }
      // "BAD LEDGER" bar
      g.fillStyle(RUNNER_COLORS.danger, 0.35)
      g.fillRect(6, 10, w - 12, 14)
      g.generateTexture('barrier', w, h)
      g.destroy()
    }

    if (!this.textures.exists('floater')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 36
      g.fillStyle(RUNNER_COLORS.quantum, 0.25)
      g.fillCircle(s / 2, s / 2, s / 2)
      g.lineStyle(2, RUNNER_COLORS.quantum, 0.95)
      g.strokeCircle(s / 2, s / 2, s / 2 - 1)
      g.fillStyle(RUNNER_COLORS.bronzeBright, 0.85)
      g.fillCircle(s / 2, s / 2, 6)
      g.generateTexture('floater', s, s)
      g.destroy()
    }

    // Low beam — must slide (clearly marked SLIDE)
    if (!this.textures.exists('lowbeam')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 56
      const h = 100
      g.fillStyle(RUNNER_COLORS.danger, 0.92)
      g.fillRoundedRect(0, 0, w, h, 4)
      g.lineStyle(2, 0xfef2f2, 0.9)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 4)
      g.fillStyle(0x020617, 0.85)
      g.fillRect(6, h - 22, w - 12, 14)
      g.fillStyle(0xfef2f2, 1)
      // simple “SLIDE” bars
      g.fillRect(12, h - 16, w - 24, 3)
      g.fillRect(12, h - 10, w - 24, 3)
      g.generateTexture('lowbeam', w, h)
      g.destroy()
    }

    // SUPER power-up — bright gold star orb (force-refresh for newer art)
    if (this.textures.exists('powerup')) this.textures.remove('powerup')
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 40
      const c = s / 2
      // Soft outer glow
      g.fillStyle(0xf0c14a, 0.28)
      g.fillCircle(c, c, 19)
      // Main coin
      g.fillStyle(RUNNER_COLORS.bronzeBright, 1)
      g.fillCircle(c, c, 14)
      g.lineStyle(3, 0xfef3c7, 1)
      g.strokeCircle(c, c, 14)
      g.lineStyle(2, RUNNER_COLORS.bronze, 0.95)
      g.strokeCircle(c, c, 11)
      // 4-point star
      g.fillStyle(0xfef3c7, 1)
      g.fillTriangle(c, 6, c - 4, c, c + 4, c)
      g.fillTriangle(c, s - 6, c - 4, c, c + 4, c)
      g.fillTriangle(6, c, c, c - 4, c, c + 4)
      g.fillTriangle(s - 6, c, c, c - 4, c, c + 4)
      // Core spark
      g.fillStyle(0xffffff, 0.95)
      g.fillCircle(c, c, 3.2)
      g.generateTexture('powerup', s, s)
      g.destroy()
    }

    // Elevated runway tile
    if (!this.textures.exists('runway')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 64
      const h = 18
      g.fillStyle(RUNNER_COLORS.bronzeDark, 1)
      g.fillRoundedRect(0, 4, w, h - 4, 3)
      g.fillStyle(RUNNER_COLORS.bronze, 1)
      g.fillRoundedRect(0, 0, w, 8, 2)
      g.lineStyle(1.5, RUNNER_COLORS.bronzeBright, 0.9)
      g.lineBetween(4, 4, w - 4, 4)
      g.lineStyle(1, RUNNER_COLORS.quantum, 0.45)
      for (let x = 8; x < w; x += 12) g.lineBetween(x, 2, x, 6)
      g.generateTexture('runway', w, h)
      g.destroy()
    }

    // Pit void — high-contrast so it doesn’t blend into the ground strip
    for (const key of ['pit-void', 'pit-rim', 'pit-warn']) {
      if (this.textures.exists(key)) this.textures.remove(key)
    }
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 64
      const h = 88
      // Deep black hole
      g.fillStyle(0x000000, 1)
      g.fillRect(0, 0, w, h)
      // Red danger wash
      g.fillStyle(RUNNER_COLORS.danger, 0.22)
      g.fillRect(0, 0, w, h)
      // Hot lip at the rim (reads as broken floor edge)
      g.fillStyle(RUNNER_COLORS.danger, 0.95)
      g.fillRect(0, 0, w, 5)
      g.fillStyle(0xfef2f2, 0.9)
      g.fillRect(0, 0, w, 2)
      g.fillStyle(RUNNER_COLORS.bronzeBright, 0.75)
      g.fillRect(0, 5, w, 3)
      // Depth lines
      g.lineStyle(1, RUNNER_COLORS.danger, 0.45)
      for (let y = 16; y < h; y += 10) g.lineBetween(2, y, w - 2, y)
      // Hazard chevrons
      g.fillStyle(RUNNER_COLORS.bronzeBright, 0.85)
      for (let x = 8; x < w - 4; x += 14) {
        g.fillTriangle(x, 14, x + 5, 22, x - 5, 22)
      }
      g.generateTexture('pit-void', w, h)
      g.destroy()
    }
    // Vertical rim posts at pit edges
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 14
      const h = 40
      g.fillStyle(RUNNER_COLORS.danger, 1)
      g.fillRoundedRect(0, 0, w, h, 2)
      g.lineStyle(2, 0xfef2f2, 0.95)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 2)
      g.fillStyle(RUNNER_COLORS.bronzeBright, 1)
      g.fillRect(3, 4, w - 6, 4)
      g.fillRect(3, h - 10, w - 6, 4)
      g.generateTexture('pit-rim', w, h)
      g.destroy()
    }
    // Floating WARN diamond ahead of pit
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      const s = 28
      const c = s / 2
      g.fillStyle(RUNNER_COLORS.danger, 0.95)
      g.fillTriangle(c, 2, s - 2, c, c, s - 2)
      g.fillTriangle(c, 2, 2, c, c, s - 2)
      g.lineStyle(2, 0xfef2f2, 1)
      g.strokeTriangle(c, 2, s - 2, c, 2, c)
      g.strokeTriangle(c, s - 2, s - 2, c, 2, c)
      g.fillStyle(0xfef2f2, 1)
      g.fillRect(c - 1.5, 8, 3, 9)
      g.fillCircle(c, s - 8, 2)
      g.generateTexture('pit-warn', s, s)
      g.destroy()
    }
  }

  private createGround(width: number) {
    this.groundGfx = this.add.graphics().setDepth(3)
    // Solid ground fill
    const fill = this.add
      .rectangle(
        width / 2,
        (this.groundY + this.scale.height) / 2,
        width,
        this.scale.height - this.groundY,
        RUNNER_COLORS.ground,
        1,
      )
      .setDepth(2)
    fill.setStrokeStyle(0)
    this.drawGround(0)
  }

  private drawGround(delta: number) {
    if (this.state === 'playing') {
      this.groundScroll =
        (this.groundScroll + this.scrollSpeed * (delta / 1000)) % 48
    }

    const { width, height } = this.scale
    this.groundGfx.clear()
    // Top edge line
    this.groundGfx.lineStyle(2, RUNNER_COLORS.groundLine, 0.85)
    this.groundGfx.lineBetween(0, this.groundY, width, this.groundY)

    // Tick marks scrolling left
    this.groundGfx.lineStyle(1, RUNNER_COLORS.bronzeDark, 0.55)
    for (let x = -48; x < width + 48; x += 48) {
      const px = x - this.groundScroll
      this.groundGfx.lineBetween(px, this.groundY, px, this.groundY + 10)
    }

    // Subtle grid below ground
    this.groundGfx.lineStyle(1, RUNNER_COLORS.border, 0.35)
    for (let y = this.groundY + 24; y < height; y += 24) {
      this.groundGfx.lineBetween(0, y, width, y)
    }
  }

  private setupInput() {
    // Multi-touch so second finger isn’t dropped
    this.input.addPointer(2)

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
      this.keyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
      this.keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
      this.keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
      // Keep Space / arrows from scrolling the host page and losing focus
      this.input.keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.W,
        Phaser.Input.Keyboard.KeyCodes.S,
      ])

      // Edge-triggered jump outside the update loop (more reliable than JustDown alone)
      const queueKeyJump = (event: KeyboardEvent) => {
        if (this.waitingHowTo || this.paused) return
        if (event.repeat) return
        const code = event.code
        if (
          code !== 'Space' &&
          code !== 'ArrowUp' &&
          code !== 'KeyW'
        ) {
          return
        }
        event.preventDefault()
        if (this.state === 'ready') {
          this.beginRun()
          return
        }
        if (this.state === 'gameover') {
          this.resetRun()
          this.beginRun()
          return
        }
        if (this.state === 'playing') {
          this.requestJump()
        }
      }
      this.input.keyboard.on('keydown', queueKeyJump)
    }

    // Prefer scene pointer events; also bind to the game canvas for iframe quirks
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerTap(pointer)
    })
  }

  private handlePointerTap(pointer: Phaser.Input.Pointer) {
    if (this.waitingHowTo || this.paused) return
    // Ignore taps on the pause control (top-right)
    if (pointer.y < 48 && pointer.x > this.scale.width - 56) return

    if (this.state === 'ready') {
      this.beginRun()
      return
    }
    if (this.state === 'gameover') {
      this.resetRun()
      this.beginRun()
      return
    }
    if (this.state !== 'playing') return

    if (!this.zonesFaded) {
      this.zonesFaded = true
      this.time.delayedCall(1400, () => this.touchUi.setActive(false))
    }

    // Jump is default. Slide only on a thin bottom strip of the *screen*
    // (not near the runner’s feet — that was eating jump taps).
    if (this.isSlideTouch(pointer.y) && this.time.now >= this.slideLockUntil) {
      this.touchUi.pulse('b')
      if (this.onGround && !this.isSliding) {
        this.startSlide()
      } else {
        // In air or already sliding → treat as jump so the tap never “does nothing”
        this.requestJump()
      }
    } else {
      this.touchUi.pulse('a')
      this.requestJump()
    }
  }

  /**
   * Slide zone = bottom ~12% of the canvas only.
   * Everything else is jump (including around the character).
   */
  private isSlideTouch(pointerY: number): boolean {
    return pointerY >= this.scale.height * 0.88
  }

  /** Queue + immediately try (touch and key share this path). */
  private requestJump() {
    this.queueJump()
    this.tryConsumeJumpBuffer()
  }

  private createHud(width: number, height: number) {
    this.add
      .rectangle(12, 12, 168, 58, 0x0f172a, 0.82)
      .setOrigin(0, 0)
      .setStrokeStyle(1, RUNNER_COLORS.bronze, 0.35)
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
      .text(22, 44, `THRESHOLD  ${LEDGER_RUNNER_REWARD_THRESHOLD}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        color: '#94a3b8',
        fontStyle: '600',
      })
      .setDepth(31)

    this.hudCombo = this.add
      .text(width - 56, 22, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        color: '#d4922a',
        fontStyle: '700',
      })
      .setOrigin(1, 0)
      .setDepth(31)

    this.hudHint = this.add
      .text(
        width / 2,
        height - 24,
        'SPACE jump  ·  ↓ / floor tap slide  ·  air tap jump  ·  P pause',
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
      startTrail(this.trail, this.player)
    }
  }

  private createOverlay() {
    if (this.overlay) {
      this.overlay.destroy(true)
    }

    const { width, height } = this.scale
    const container = this.add.container(width / 2, height / 2 - 20).setDepth(40)
    const panel = this.add
      .rectangle(0, 0, 440, 220, RUNNER_COLORS.panel, 0.94)
      .setStrokeStyle(2, RUNNER_COLORS.bronze, 0.7)

    const title = this.add
      .text(0, -62, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '30px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setOrigin(0.5)

    const body = this.add
      .text(0, -6, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '15px',
        color: '#94a3b8',
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5)

    const cta = this.add
      .text(0, 68, '', {
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
    container.setSize(440, 220)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-220, -110, 440, 220),
      Phaser.Geom.Rectangle.Contains,
    )
    container.on('pointerdown', () => {
      if (this.state === 'ready') {
        this.beginRun()
      } else if (this.state === 'gameover') {
        this.resetRun()
        this.beginRun()
      }
    })

    this.overlay = container
  }

  private showOverlay(mode: 'ready' | 'gameover') {
    // Never show death chrome unless we are actually halted
    if (mode === 'gameover' && this.state !== 'gameover') return

    this.createOverlay()
    const title = this.overlay.getData('title') as Phaser.GameObjects.Text
    const body = this.overlay.getData('body') as Phaser.GameObjects.Text
    const cta = this.overlay.getData('cta') as Phaser.GameObjects.Text

    if (mode === 'ready') {
      title.setText('Ledger Runner')
      body.setText(
        'Jump spikes & floor pits (wide = double-jump) · slide low beams · SUPER free hit · high runways skip ground hazards.',
      )
      cta.setText('TAP / SPACE TO RUN')
    } else {
      title.setText('Ledger Halted')
      body.setText(
        `Final score  ${this.score}\nClear ${LEDGER_RUNNER_REWARD_THRESHOLD} points to unlock the Game Faucet claim.`,
      )
      cta.setText('TAP / SPACE TO RESTART')
    }

    this.overlay.setVisible(true)
    this.overlay.setActive(true)
    this.hudHint.setText(
      mode === 'ready'
        ? 'SPACE / tap to jump  ·  ↓ or bottom edge to slide'
        : 'SPACE or tap to restart',
    )
  }

  private hideOverlay() {
    if (!this.overlay) return
    this.overlay.setVisible(false)
    this.overlay.setActive(false)
    if (this.overlay.input) this.overlay.disableInteractive()
  }

  private clearGameOverTimer() {
    if (this.gameOverTimer) {
      this.gameOverTimer.remove(false)
      this.gameOverTimer = undefined
    }
  }

  // ── body states ────────────────────────────────────────

  private setStandingBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const power = this.powered ? LEDGER_RUNNER.powerScale : 1
    // Scale the invisible hitbox so SUPER is truly taller (texture is 32×48)
    this.player.setScale(power)
    const w = LEDGER_RUNNER.playerW
    const h = LEDGER_RUNNER.playerH
    body.setSize(w, h)
    body.setOffset((32 - w) / 2, (48 - h) / 2)
    const floor = this.floorY()
    const half = this.player.displayHeight / 2
    if (this.onGround || this.player.y > floor - this.player.displayHeight) {
      this.player.y = floor - half
      body.updateFromGameObject()
    }
    this.playerVisual.setScale(power)
  }

  private setSlideBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const power = this.powered ? LEDGER_RUNNER.powerScale : 1
    // Crouch: shorter visual + hitbox (still wider when SUPER)
    this.player.setScale(power * 1.05, power * 0.55)
    const w = LEDGER_RUNNER.playerW + 6
    const h = LEDGER_RUNNER.slideH
    body.setSize(w, h)
    body.setOffset((32 - w) / 2, (48 - h) / 2)
    const half = this.player.displayHeight / 2
    this.player.y = this.floorY() - half
    body.updateFromGameObject()
    this.playerVisual.setScale(power * 1.05, power * 0.7)
  }

  private applyPowerState(powered: boolean, flash = true) {
    this.powered = powered
    if (this.isSliding) this.setSlideBody()
    else this.setStandingBody()
    if (flash) {
      this.cameras.main.flash(
        120,
        powered ? 208 : 248,
        powered ? 146 : 113,
        powered ? 42 : 113,
        false,
      )
      floatScoreText(
        this,
        this.player.x,
        this.player.y - 36,
        powered ? 'SUPER!' : 'SHRINK',
        powered ? '#d4922a' : '#94a3b8',
      )
    }
  }

  // ── run lifecycle ──────────────────────────────────────

  private resetRun() {
    this.clearGameOverTimer()
    this.state = 'ready'
    this.paused = false
    this.physics.resume()
    this.pauseDim?.setVisible(false)
    this.pauseLabel?.setVisible(false)
    this.score = 0
    this.combo = 0
    this.distanceAccumulator = 0
    this.scrollSpeed = LEDGER_RUNNER.baseScrollSpeed
    this.difficulty = 0
    this.elapsedPlayMs = 0
    this.nextSpawnAt = 0
    this.jumpsRemaining = 2
    this.isSliding = false
    this.slideUntil = 0
    this.zonesFaded = false
    this.invulnUntil = 0
    this.jumpBufferUntil = 0
    this.coyoteUntil = 0
    this.slideLockUntil = 0
    this.jumpBoostUntil = 0
    this.wasOnGround = true
    this.onGround = true
    this.touchUi?.setActive(true)
    stopTrail(this.trail)

    this.hazards.clear(true, true)
    this.powered = false
    this.onPlatform = false
    this.waveIndex = 0
    this.waveRemaining = 0
    this.waveStep = 0
    this.wavePattern = 'spikes'
    this.waveLabelUntil = 0
    this.endSlide()
    this.applyPowerState(false, false)
    this.player.setPosition(
      LEDGER_RUNNER.playerX,
      this.groundY - this.standH() / 2,
    )
    this.player.setVelocity(0, 0)
    this.tweens.killTweensOf(this.playerVisual)
    this.playerVisual.setAlpha(1)
    this.playerVisual.setAngle(0)
    this.playerVisual.y = this.player.y
    this.hudScore.setText('SCORE  0')
    this.hudScore.setColor('#f1f5f9')
    this.hudCombo.setText('')
    this.hideOverlay()
    this.emitScore(0)
  }

  private beginRun() {
    if (this.waitingHowTo) return
    this.clearGameOverTimer()
    this.state = 'playing'
    this.hideOverlay()
    this.nextSpawnAt = this.time.now + 900
    this.invulnUntil = this.time.now + 700
    this.jumpsRemaining = 2
    this.jumpBufferUntil = 0
    this.coyoteUntil = 0
    this.slideLockUntil = 0
    this.jumpBoostUntil = 0
    this.wasOnGround = true
    this.onGround = true
    this.tweens.killTweensOf(this.playerVisual)
    this.playerVisual.setAlpha(1)
    this.playerVisual.setAngle(0)
    this.waveIndex = 0
    this.waveRemaining = 0
    this.waveStep = 0
    this.wavePattern = 'spikes'
    this.waveLabelUntil = 0
    this.hudHint.setText(
      'Jump pits · slide beams · SUPER · double-jump runways/wide pits',
    )
    startTrail(this.trail, this.player)
    this.emitState('playing')
  }

  private shouldProcessHazard(haz: Phaser.Physics.Arcade.Image): boolean {
    if (this.time.now < this.invulnUntil) return false
    if (this.state !== 'playing' || this.paused) return false
    const meta = haz.getData('meta') as HazardMeta | undefined
    if (!meta) return true
    // Pits / voids handled via fall logic, not body overlap
    if (meta.isPit) return false
    // Elevated runway is a full safe path — ignore anything below the deck
    if (this.onPlatform) {
      if (meta.lane === 'ground') return false
      if (meta.isPlatform || meta.noDamage) return false
      // Extra: any hazard whose top is below the platform surface
      if (
        meta.dangerBottom <= this.activePlatformTop + 4 ||
        haz.y + haz.displayHeight / 2 < this.activePlatformTop + 8
      ) {
        return false
      }
    }
    // On ground: ignore high-only pieces
    if (!this.onPlatform && meta.lane === 'high') return false
    return true
  }

  /** True if runner X is over a floor hole (and not on elevated runway). */
  private isOverPit(px: number): { over: boolean; needsDouble: boolean } {
    for (const haz of this.hazards.getChildren() as Phaser.Physics.Arcade.Image[]) {
      const meta = haz.getData('meta') as HazardMeta | undefined
      if (!meta?.isPit) continue
      const left = meta.pitLeft ?? haz.x - haz.displayWidth / 2
      const right = meta.pitRight ?? haz.x + haz.displayWidth / 2
      if (px >= left + 2 && px <= right - 2) {
        return { over: true, needsDouble: Boolean(meta.needsDoubleJump) }
      }
    }
    return { over: false, needsDouble: false }
  }

  private onHazardOverlap(haz: Phaser.Physics.Arcade.Image) {
    const meta = haz.getData('meta') as HazardMeta | undefined
    if (!meta) {
      this.handleCrash()
      return
    }
    if (meta.noDamage || meta.isPlatform) return
    if (meta.isPowerup) {
      if (!meta.scored) {
        meta.scored = true
        this.applyPowerState(true)
        this.addScore(15)
        haz.destroy()
      }
      return
    }
    this.handleCrash()
  }

  private handleCrash() {
    if (this.state !== 'playing' || this.paused) return
    if (this.time.now < this.invulnUntil) return

    // Mario-style: powered → shrink and survive once
    if (this.powered) {
      this.applyPowerState(false)
      this.invulnUntil = this.time.now + 1400
      this.combo = Math.max(0, this.combo - 1)
      this.hudCombo.setText('')
      nearMissSpark(this, this.sparkEmitter, this.player.x, this.player.y)
      this.cameras.main.shake(100, 0.008)
      return
    }

    this.state = 'gameover'
    this.player.setVelocity(0, 0)
    this.combo = 0
    this.hudCombo.setText('')
    stopTrail(this.trail)
    this.clearGameOverTimer()

    playDeathJuice(
      this,
      this.player.x,
      this.player.y,
      this.difficulty,
      this.deathEmitter,
    )

    this.tweens.killTweensOf(this.playerVisual)
    this.tweens.add({
      targets: this.playerVisual,
      alpha: 0.25,
      angle: -28,
      y: this.player.y + 8,
      duration: 280,
      ease: 'Quad.easeOut',
    })

    this.gameOverTimer = this.time.delayedCall(340, () => {
      this.gameOverTimer = undefined
      if (this.state !== 'gameover') return
      this.showOverlay('gameover')
      this.emitState('gameover')
      this.emitScore(this.score)
    })
  }

  // ── input helpers ──────────────────────────────────────

  private consumeJumpPress(): boolean {
    const space =
      this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)
    const up =
      (this.cursors?.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
      (this.keyUp && Phaser.Input.Keyboard.JustDown(this.keyUp)) ||
      (this.keyW && Phaser.Input.Keyboard.JustDown(this.keyW))
    return Boolean(space || up)
  }

  private consumeStartPress(): boolean {
    return Boolean(
      this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace),
    )
  }

  /** Remember a jump request for a short window (buffer). */
  private queueJump() {
    this.jumpBufferUntil = this.time.now + 320
  }

  /** Attempt jump if a buffered press is still live. */
  private tryConsumeJumpBuffer() {
    if (this.time.now > this.jumpBufferUntil) return
    if (this.tryJump()) {
      this.jumpBufferUntil = 0
    }
  }

  private handleSlideInput() {
    if (this.time.now < this.slideLockUntil) return
    if (this.time.now < this.jumpBoostUntil) return
    const downHeld =
      this.cursors?.down.isDown ||
      this.keyS?.isDown ||
      this.keyDown?.isDown ||
      this.keyZ?.isDown

    if (downHeld && this.onGround && !this.isSliding) {
      this.startSlide()
    }
  }

  /**
   * @returns true if a jump actually fired (so the buffer can clear).
   */
  private tryJump(): boolean {
    if (this.state !== 'playing') return false

    // Cancel slide into a jump (common when mashing)
    if (this.isSliding) {
      this.endSlide()
      this.onGround = true
      this.jumpsRemaining = 2
    }

    // Refresh grounded snap for this instant (don’t trust stale flag alone)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const halfH = body.halfHeight
    const feet = this.player.y + halfH
    const pit = this.isOverPit(this.player.x)
    const holeOpen = pit.over && !this.onPlatform
    const feetOnFloor =
      !holeOpen && feet >= this.floorY() - 4
    const rising = body.velocity.y < -30
    const groundedNow =
      (this.onGround || feetOnFloor) &&
      !rising &&
      this.time.now >= this.jumpBoostUntil

    const coyote =
      !groundedNow &&
      this.time.now <= this.coyoteUntil
    const canGroundJump = groundedNow || coyote
    const canAirJump = !canGroundJump && this.jumpsRemaining > 0

    if (!canGroundJump && !canAirJump) return false

    const isDouble = !canGroundJump
    const s = this.hScale()
    const vy =
      (isDouble
        ? LEDGER_RUNNER.doubleJumpVelocity
        : LEDGER_RUNNER.jumpVelocity) * s

    // Lift off the floor slightly so the next ground pass cannot stick us
    if (canGroundJump && feetOnFloor) {
      this.player.y = this.floorY() - halfH - 2
      body.updateFromGameObject()
    }

    body.setAllowGravity(true)
    body.setVelocityY(vy)
    this.player.setVelocityY(vy)

    if (canGroundJump) {
      this.jumpsRemaining = 1
      this.coyoteUntil = 0
    } else {
      this.jumpsRemaining = Math.max(0, this.jumpsRemaining - 1)
    }
    this.onGround = false
    this.wasOnGround = false
    this.slideLockUntil = this.time.now + 200
    // Critical: ground clamp must not zero this hop for ~150ms
    this.jumpBoostUntil = this.time.now + 150

    this.tweens.killTweensOf(this.playerVisual)
    this.playerVisual.setScale(1, 1)
    this.tweens.add({
      targets: this.playerVisual,
      scaleY: 0.88,
      scaleX: 1.08,
      duration: 70,
      yoyo: true,
    })
    return true
  }

  private startSlide() {
    if (this.state !== 'playing' || !this.onGround || this.isSliding) return
    if (this.time.now < this.slideLockUntil) return

    this.isSliding = true
    this.slideUntil = this.time.now + LEDGER_RUNNER.slideDurationMs
    // Sliding spends nothing, but clear stale jump buffer so we don’t auto-hop out
    this.jumpBufferUntil = 0
    this.setSlideBody()
    this.player.setVelocityY(0)
  }

  private endSlide() {
    if (!this.isSliding) {
      this.setStandingBody()
      return
    }
    this.isSliding = false
    this.setStandingBody()
  }

  /** Best elevated runway under the player, if any. */
  private findPlatformTop(): number | null {
    const px = this.player.x
    let best: number | null = null
    for (const haz of this.hazards.getChildren() as Phaser.Physics.Arcade.Image[]) {
      const meta = haz.getData('meta') as HazardMeta | undefined
      if (!meta?.isPlatform || meta.platformTop == null) continue
      const left = meta.platformLeft ?? haz.x - haz.displayWidth / 2
      const right = meta.platformRight ?? haz.x + haz.displayWidth / 2
      if (px < left - 6 || px > right + 6) continue
      const top = meta.platformTop
      if (best === null || top < best) best = top
    }
    return best
  }

  /**
   * Visual foot drop below body center (emblem boots sit lower than the hitbox).
   * Used so feet rest on the deck instead of poking through.
   */
  private visualFootExtent(): number {
    const sc = Math.abs(this.playerVisual?.scaleY || 1)
    return 26 * sc
  }

  private updateGrounded() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const halfH = body.halfHeight
    const feet = this.player.y + halfH
    const boosting = this.time.now < this.jumpBoostUntil
    const vy = body.velocity.y

    // Prefer elevated runway if feet are near it while falling/resting
    const platTop = this.findPlatformTop()
    let floor = this.groundY
    this.onPlatform = false
    // Generous vertical snap so landing on the deck is reliable
    if (
      platTop != null &&
      vy >= -40 &&
      feet >= platTop - 22 &&
      feet <= platTop + 28
    ) {
      if (platTop < this.groundY - 40) {
        floor = platTop
        this.onPlatform = true
        this.activePlatformTop = platTop
      }
    }

    const pit = this.isOverPit(this.player.x)
    // Over a floor hole (and not on a high runway): no ground support
    const holeOpen = pit.over && !this.onPlatform

    // Fell into the pit (past the spike tips)
    if (holeOpen && feet > this.groundY + 28) {
      this.handleCrash()
      return
    }

    // During jump boost: never zero upward velocity (this was eating hops)
    if (boosting) {
      if (!holeOpen && feet > floor + 6) {
        this.player.y = floor - halfH - 1
        body.updateFromGameObject()
      }
      this.onGround = false
      return
    }

    // Only land when falling or resting — never while rising, never into a pit
    const grounded = !holeOpen && feet >= floor - 3.5 && vy >= -20

    if (grounded) {
      // Physics feet on surface
      this.player.y = floor - halfH
      body.updateFromGameObject()
      this.player.setVelocityY(0)
      if (!this.onGround) {
        this.jumpsRemaining = 2
      }
      this.onGround = true
      this.wasOnGround = true
      this.coyoteUntil = 0
      this.tryConsumeJumpBuffer()
    } else {
      if (this.wasOnGround && this.onGround) {
        this.coyoteUntil = this.time.now + 160
      }
      this.onGround = false
      this.wasOnGround = false
      if (holeOpen) this.onPlatform = false
    }

    // Hard floor clamp to main ground — never while over a pit
    if (
      !this.onPlatform &&
      !holeOpen &&
      this.player.y + halfH > this.groundY &&
      body.velocity.y >= 0
    ) {
      this.player.y = this.groundY - halfH
      body.updateFromGameObject()
      this.player.setVelocityY(0)
      this.onGround = true
      this.wasOnGround = true
      this.jumpsRemaining = 2
      this.coyoteUntil = 0
      this.tryConsumeJumpBuffer()
    }
  }

  private idleBob(delta: number) {
    this.runBob += delta
    const bob = Math.sin(this.runBob / 220) * 3
    this.player.y = this.groundY - LEDGER_RUNNER.playerH / 2 + bob
    this.playerVisual.y = this.player.y
    this.playerVisual.x = this.player.x
  }

  private syncPlayerVisual(delta: number) {
    if (!this.playerVisual || !this.player || !this.runnerEmblem) return

    this.playerVisual.x = this.player.x
    // Sit visual feet on the walk surface (emblem boots hang below hitbox center)
    if (this.onGround || this.isSliding) {
      const foot = this.visualFootExtent()
      const surface = this.floorY()
      // When sliding, crouch emblem is shorter
      const footDown = this.isSliding ? foot * 0.72 : foot
      this.playerVisual.y = surface - footDown
    } else {
      this.playerVisual.y = this.player.y
    }

    if (this.state === 'playing' && this.onGround && !this.isSliding) {
      this.runBob += delta * (1 + this.difficulty * 0.8)
    } else {
      this.runBob += delta * 0.4
    }

    let mood: CharacterMood = 'idle'
    if (this.state === 'gameover') mood = 'dead'
    else if (this.state === 'playing') {
      if (this.isSliding) mood = 'boost'
      else if (!this.onGround) mood = 'boost'
      else mood = this.combo >= 4 ? 'boost' : 'play'
    }

    if (!this.onGround && this.state === 'playing' && !this.isSliding) {
      this.playerVisual.angle = Phaser.Math.Clamp(
        (this.player.body?.velocity.y ?? 0) / 40,
        -18,
        22,
      )
    } else if (!this.isSliding) {
      this.playerVisual.angle = Phaser.Math.Linear(this.playerVisual.angle, 0, 0.2)
    }

    animateRunnerEmblem(this.runnerEmblem, delta, this.runBob, mood, {
      onGround: this.onGround && this.state === 'playing',
      sliding: this.isSliding,
      runBob: this.runBob,
      vy: this.player.body?.velocity.y ?? 0,
      speedFactor:
        this.state === 'playing'
          ? this.scrollSpeed / LEDGER_RUNNER.baseScrollSpeed
          : 0.9,
    })
  }

  // ── scoring ────────────────────────────────────────────

  private advanceScore(delta: number) {
    const speedFactor = this.scrollSpeed / LEDGER_RUNNER.baseScrollSpeed
    this.distanceAccumulator +=
      (LEDGER_RUNNER.distancePointsPerSecond * speedFactor * delta) / 1000

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
      this.score >= LEDGER_RUNNER_REWARD_THRESHOLD &&
      prev < LEDGER_RUNNER_REWARD_THRESHOLD
    ) {
      this.hudScore.setColor('#d4922a')
      this.cameras.main.flash(90, 208, 146, 42, false)
      floatScoreText(this, this.player.x, this.player.y - 40, 'THRESHOLD!', '#d4922a', {
        fontSize: '18px',
      })
    }
    if (this.score > this.bestScore) {
      const was = this.bestScore
      this.bestScore = this.score
      if (was > 0) this.flashNewBest()
    }
    this.tweens.add({
      targets: this.hudScore,
      scale: 1.08,
      duration: 70,
      yoyo: true,
    })
    this.emitScore(this.score)
  }

  private flashNewBest() {
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

  private registerClear(perfect: boolean) {
    this.combo = Math.min(LEDGER_RUNNER.maxCombo, this.combo + 1)
    let bonus = LEDGER_RUNNER.clearBonus
    if (perfect) {
      bonus += LEDGER_RUNNER.perfectBonus
    }
    bonus += Math.max(0, this.combo - 1) * LEDGER_RUNNER.comboStepBonus
    this.addScore(bonus)
    this.showComboFeedback(perfect, bonus)
  }

  private showComboFeedback(perfect: boolean, bonus: number) {
    const label = perfect
      ? `PERFECT  x${this.combo}`
      : this.combo > 1
        ? `COMBO  x${this.combo}`
        : 'CLEAN'
    this.hudCombo.setText(this.combo > 1 || perfect ? label : '')
    this.hudCombo.setScale(1.25)
    this.tweens.add({
      targets: this.hudCombo,
      scale: 1,
      duration: 160,
      ease: 'Back.easeOut',
    })

    if (perfect) {
      flashCleanPass(this)
      nearMissSpark(this, this.sparkEmitter, this.player.x + 24, this.player.y - 10)
      floatScoreText(
        this,
        this.player.x + 36,
        this.player.y - 44,
        `+${bonus} PERFECT`,
        '#22d3ee',
      )
    } else {
      flashCleanPass(this, 0.08)
      floatScoreText(
        this,
        this.player.x + 36,
        this.player.y - 40,
        this.combo > 1 ? `+${bonus} COMBO` : `+${bonus} CLEAN`,
        '#d4922a',
      )
    }
  }

  // ── hazards / wave director ────────────────────────────

  /**
   * Rightmost X still occupied by a ground-lane hazard (or pit apron).
   * Used so the next spawn never stacks on top of the previous one.
   */
  private groundTrackRightEdge(): number {
    const s = this.softH()
    let maxR = this.scale.width
    for (const haz of this.hazards.getChildren() as Phaser.Physics.Arcade.Image[]) {
      const meta = haz.getData('meta') as HazardMeta | undefined
      if (!meta) continue
      if (meta.isPlatform || meta.lane === 'high') continue
      if (meta.isPit && meta.pitRight != null) {
        // Clear floor after the pit so landing isn’t into another hazard
        const apron = meta.needsDoubleJump ? 160 * s : 110 * s
        maxR = Math.max(maxR, meta.pitRight + apron)
        continue
      }
      // Ignore pure pit cosmetics with noDamage that aren’t scoring markers
      if (meta.isPit) continue
      if (meta.isPowerup || meta.kind === 'floater') {
        maxR = Math.max(maxR, haz.x + haz.displayWidth / 2 + 40 * s)
        continue
      }
      maxR = Math.max(maxR, haz.x + haz.displayWidth / 2)
    }
    return maxR
  }

  /** Off-screen spawn X that clears all existing ground hazards. */
  private nextGroundSpawnX(extraPad = 0): number {
    const s = this.softH()
    const minOffscreen = this.scale.width + 55
    const clearOf = this.groundTrackRightEdge() + (90 + extraPad) * s
    return Math.max(minOffscreen, clearOf)
  }

  /** Remove ground obstacles that would sit inside a new pit / approach zone. */
  private clearGroundHazardsInRange(left: number, right: number) {
    for (const haz of [
      ...this.hazards.getChildren(),
    ] as Phaser.Physics.Arcade.Image[]) {
      const meta = haz.getData('meta') as HazardMeta | undefined
      if (!meta) continue
      if (meta.isPlatform || meta.isPit) continue
      if (meta.lane === 'high') continue
      const hx = haz.x
      const half = haz.displayWidth / 2
      if (hx + half > left && hx - half < right) {
        haz.destroy()
      }
    }
  }

  private unlockedRunnerWaves(): RunnerWavePattern[] {
    const d = this.difficulty
    // Easy intro — SUPER available early so players learn it before hard waves
    const list: RunnerWavePattern[] = [
      'spikes',
      'floaters',
      'powerups',
      'spikes',
    ]
    if (d >= 0.06) list.push('pits_small', 'powerups')
    if (d >= 0.14) list.push('slide_beams')
    if (d >= 0.22) list.push('barriers', 'spike_beam', 'powerups')
    if (d >= 0.3) list.push('pits_wide')
    if (d >= 0.4) list.push('runway')
    // Late game: recycle easier waves + keep SUPER in rotation
    if (d >= 0.5) list.push('spikes', 'slide_beams', 'floaters', 'powerups')
    return list
  }

  private waveDisplayName(p: RunnerWavePattern): string {
    switch (p) {
      case 'spikes':
        return 'SPIKES'
      case 'floaters':
        return 'FLOATERS'
      case 'slide_beams':
        return 'SLIDE BEAMS'
      case 'barriers':
        return 'LEDGER GATES'
      case 'pits_small':
        return 'FLOOR GAPS'
      case 'pits_wide':
        return 'WIDE PITS'
      case 'powerups':
        return 'SUPER ORBS'
      case 'runway':
        return 'HIGH RUNWAY'
      case 'spike_beam':
        return 'SPIKE → SLIDE'
      default:
        return 'HAZARDS'
    }
  }

  private wavePlan(p: RunnerWavePattern): { count: number; spacing: number } {
    const d = this.difficulty
    switch (p) {
      case 'spikes':
        return { count: 3 + Math.floor(d * 2), spacing: 1.15 }
      case 'floaters':
        return { count: 2 + Math.floor(d * 2), spacing: 1.2 }
      case 'slide_beams':
        return { count: 2 + Math.floor(d * 1.5), spacing: 1.3 }
      case 'barriers':
        return { count: 2 + Math.floor(d), spacing: 1.25 }
      case 'pits_small':
        return { count: 2 + Math.floor(d), spacing: 1.45 }
      case 'pits_wide':
        return { count: 1 + Math.floor(d), spacing: 1.65 }
      case 'powerups':
        // Often a SUPER orb mid-wave so it’s not rare end-game only
        return { count: 1, spacing: 1.05 }
      case 'runway':
        return { count: 1, spacing: 1.7 }
      case 'spike_beam':
        // Spatial pad handles distance; keep time gap readable
        return { count: 2, spacing: 0.85 }
      default:
        return { count: 3, spacing: 1.15 }
    }
  }

  private startNextRunnerWave() {
    const unlocked = this.unlockedRunnerWaves()
    this.wavePattern = unlocked[this.waveIndex % unlocked.length]
    this.waveIndex += 1
    this.waveStep = 0
    this.waveRemaining = this.wavePlan(this.wavePattern).count
    this.waveLabelUntil = this.time.now + 1300
    if (this.hudHint && this.state === 'playing') {
      this.hudHint.setText(`WAVE · ${this.waveDisplayName(this.wavePattern)}`)
    }
  }

  private spawnWaveHazard(): number {
    const plan = this.wavePlan(this.wavePattern)
    const p = this.wavePattern
    const step = this.waveStep

    switch (p) {
      case 'spikes':
        this.spawnSpike()
        break
      case 'floaters':
        this.spawnFloater()
        break
      case 'slide_beams':
        this.spawnLowBeam()
        break
      case 'barriers':
        this.spawnBarrier()
        break
      case 'pits_small':
        this.spawnFloorPit(false)
        break
      case 'pits_wide':
        this.spawnFloorPit(true)
        break
      case 'powerups':
        this.spawnPowerup()
        break
      case 'runway':
        this.spawnHighRunway()
        break
      case 'spike_beam':
        if (step === 0) this.spawnSpike()
        else this.spawnLowBeam()
        break
    }

    this.waveStep += 1
    this.waveRemaining -= 1
    return plan.spacing
  }

  private spawnHazardsIfNeeded() {
    if (this.time.now < this.nextSpawnAt) return

    const baseInterval = Phaser.Math.Linear(
      LEDGER_RUNNER.spawnMaxMs,
      LEDGER_RUNNER.spawnMinMs,
      this.difficulty,
    )

    // Wait until the track ahead is clear enough (prevents spike→pit stacks)
    const s = this.softH()
    const trackClearX = this.groundTrackRightEdge()
    if (trackClearX > this.scale.width + 40 * s) {
      // Something still close to the spawn edge — delay a bit more
      const wait =
        ((trackClearX - this.scale.width) / Math.max(120, this.scrollSpeed)) *
        1000
      this.nextSpawnAt = this.time.now + Math.min(900, Math.max(120, wait * 0.35))
      return
    }

    if (this.waveRemaining <= 0) {
      this.startNextRunnerWave()
    }

    const spacing = this.spawnWaveHazard()
    const betweenWaves = this.waveRemaining <= 0
    const gapMul = betweenWaves
      ? 1.45 + (1 - this.difficulty) * 0.35
      : spacing

    this.nextSpawnAt =
      this.time.now +
      baseInterval * gapMul * Phaser.Math.FloatBetween(0.94, 1.06)
  }

  /**
   * setSize is in texture units then scaled — never pass display pixels.
   */
  private fitHazardBody(
    obj: Phaser.Physics.Arcade.Image,
    displayW: number,
    displayH: number,
    hitScaleX = 0.72,
    hitScaleY = 0.82,
  ) {
    obj.setDisplaySize(displayW, displayH)
    const body = obj.body as Phaser.Physics.Arcade.Body
    const frameW = obj.frame.width
    const frameH = obj.frame.height
    const sourceW = frameW * hitScaleX
    const sourceH = frameH * hitScaleY
    body.setSize(sourceW, sourceH)
    body.setOffset((frameW - sourceW) / 2, (frameH - sourceH) / 2)
    body.setAllowGravity(false)
    body.updateFromGameObject()
  }

  private spawnSpike() {
    const s = this.softH()
    const x = this.nextGroundSpawnX(20)
    // Spikes stay jumpable — not too tall relative to jump arc
    const h = 34 * s
    const w = 36
    const y = this.groundY - h / 2
    const spike = this.hazards.create(x, y, 'spike') as Phaser.Physics.Arcade.Image
    this.fitHazardBody(spike, w, h, 0.7, 0.85)
    spike.setImmovable(true)
    spike.setDepth(6)

    const meta: HazardMeta = {
      kind: 'spike',
      scored: false,
      dangerTop: this.groundY - h,
      dangerBottom: this.groundY,
      lane: 'ground',
    }
    spike.setData('meta', meta)
    attachQuantumPulse(this, spike)
  }

  private spawnBarrier() {
    // Tall ledger with crawl gap — sized so STANDING always hits, SLIDE clears
    const s = this.softH()
    const x = this.nextGroundSpawnX(40)
    // Gap just above crouch height, well below standing head
    const gap = Phaser.Math.Linear(26 * s, 24 * s, this.difficulty)
    const h = Phaser.Math.Linear(150 * s, 190 * s, this.difficulty)
    const w = 48
    const bottom = this.groundY - gap
    const y = bottom - h / 2

    const barrier = this.hazards.create(x, y, 'barrier') as Phaser.Physics.Arcade.Image
    this.fitHazardBody(barrier, w, h, 0.85, 0.94)
    barrier.setImmovable(true)
    barrier.setDepth(6)

    const meta: HazardMeta = {
      kind: 'barrier',
      scored: false,
      dangerTop: y - h / 2,
      dangerBottom: bottom,
      lane: 'ground',
      requiresSlide: true,
    }
    barrier.setData('meta', meta)
  }

  /**
   * Explicit low beam — shorter/heavier visual, same slide-only clearance.
   * Standing or SUPER standing always collides unless sliding.
   */
  private spawnLowBeam() {
    const s = this.softH()
    const x = this.nextGroundSpawnX(40)
    const gap = 25 * s
    const h = Phaser.Math.Between(Math.round(100 * s), Math.round(140 * s))
    const w = 54
    const bottom = this.groundY - gap
    const y = bottom - h / 2

    const beam = this.hazards.create(x, y, 'lowbeam') as Phaser.Physics.Arcade.Image
    this.fitHazardBody(beam, w, h, 0.9, 0.95)
    beam.setImmovable(true)
    beam.setDepth(6)

    beam.setData('meta', {
      kind: 'lowbeam',
      scored: false,
      dangerTop: y - h / 2,
      dangerBottom: bottom,
      lane: 'ground',
      requiresSlide: true,
    } satisfies HazardMeta)
  }

  private spawnPowerup() {
    const s = this.softH()
    const x = this.nextGroundSpawnX(30)
    // Easy grab height — single jump or run-under if low enough
    const y = this.groundY - Phaser.Math.Between(Math.round(42 * s), Math.round(72 * s))
    const p = this.hazards.create(x, y, 'powerup') as Phaser.Physics.Arcade.Image
    const size = 36 * s
    p.setDisplaySize(size, size)
    const body = p.body as Phaser.Physics.Arcade.Body
    body.setCircle(p.frame.width * 0.42)
    body.setOffset(p.frame.width * 0.08, p.frame.width * 0.08)
    body.setAllowGravity(false)
    body.updateFromGameObject()
    p.setImmovable(true)
    p.setDepth(9)
    p.setData('meta', {
      kind: 'powerup',
      scored: false,
      dangerTop: y - 24,
      dangerBottom: y + 24,
      lane: 'any',
      noDamage: true,
      isPowerup: true,
    } satisfies HazardMeta)
    p.setData('floatPhase', Math.random() * Math.PI * 2)
    p.setData('floatBase', y)
    p.setData('floatAmp', 12 * s)
    attachQuantumPulse(this, p)
    this.tweens.add({
      targets: p,
      scale: { from: 0.92, to: 1.12 },
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private spawnFloater() {
    const s = this.softH()
    const x = this.nextGroundSpawnX(25)
    const size = 32 * s
    const baseY = this.groundY - Phaser.Math.Between(Math.floor(75 * s), Math.floor(110 * s))

    const floater = this.hazards.create(x, baseY, 'floater') as Phaser.Physics.Arcade.Image
    floater.setDisplaySize(size, size)
    const body = floater.body as Phaser.Physics.Arcade.Body
    const frameW = floater.frame.width
    const sourceR = frameW * 0.35
    body.setCircle(sourceR)
    body.setOffset((frameW - sourceR * 2) / 2, (frameW - sourceR * 2) / 2)
    body.setAllowGravity(false)
    body.updateFromGameObject()
    floater.setImmovable(true)
    floater.setDepth(6)
    floater.setData('floatPhase', Math.random() * Math.PI * 2)
    floater.setData('floatBase', baseY)
    floater.setData('floatAmp', Phaser.Math.Between(Math.floor(14 * s), Math.floor(28 * s)))

    const meta: HazardMeta = {
      kind: 'floater',
      scored: false,
      dangerTop: baseY - 36 * s,
      dangerBottom: baseY + 36 * s,
      lane: 'any',
    }
    floater.setData('meta', meta)
    attachQuantumPulse(this, floater)
  }

  /**
   * Hole in the floor with spike teeth. Small = single jump; wide = double-jump.
   * High-contrast rims + warn diamond so it doesn’t blend into the ground.
   * Always reserves approach + landing clear space so spikes can’t sit on the lips.
   */
  private spawnFloorPit(needsDouble: boolean) {
    const s = this.softH()
    // Width tuned to scroll speed: small ~one hop, wide needs second jump
    const widthPx = needsDouble
      ? Phaser.Math.Between(Math.round(200 * s), Math.round(280 * s))
      : Phaser.Math.Between(Math.round(110 * s), Math.round(155 * s))
    // Extra pad: clear approach before the lip (landing after prior hazard)
    const left = this.nextGroundSpawnX(needsDouble ? 80 : 50)
    const right = left + widthPx
    const midX = (left + right) / 2
    // Wipe any leftover ground junk that would land in/near this pit
    this.clearGroundHazardsInRange(left - 40 * s, right + 40 * s)

    const pitH = Math.max(56, this.scale.height - this.groundY + 12)
    const voidY = this.groundY + pitH / 2 - 2

    const pitMetaBase = {
      kind: 'pit' as const,
      scored: false,
      dangerTop: this.groundY,
      dangerBottom: this.scale.height,
      lane: 'ground' as const,
      noDamage: true,
      isPit: true,
      pitLeft: left,
      pitRight: right,
      needsDoubleJump: needsDouble,
    }

    // Warning diamond floating just before the lip (still on solid ground)
    const warn = this.hazards.create(
      left - 36 * s,
      this.groundY - 36 * s,
      'pit-warn',
    ) as Phaser.Physics.Arcade.Image
    warn.setDisplaySize(26 * s, 26 * s)
    const wBody = warn.body as Phaser.Physics.Arcade.Body
    wBody.enable = false
    warn.setDepth(9)
    warn.setData('meta', { ...pitMetaBase, noDamage: true })
    warn.setData('floatPhase', 0)
    warn.setData('floatBase', this.groundY - 36 * s)
    warn.setData('floatAmp', 5 * s)
    this.tweens.add({
      targets: warn,
      alpha: { from: 0.55, to: 1 },
      scale: { from: 0.9, to: 1.08 },
      duration: 420,
      yoyo: true,
      repeat: -1,
    })

    // High-contrast void under the ground line
    const voidTile = this.hazards.create(midX, voidY, 'pit-void') as Phaser.Physics.Arcade.Image
    voidTile.setDisplaySize(widthPx + 8, pitH)
    const vBody = voidTile.body as Phaser.Physics.Arcade.Body
    vBody.enable = false
    voidTile.setDepth(2)
    voidTile.setData('meta', { ...pitMetaBase })

    // Bright rim beam on the ground line (broken floor edge)
    const rimBar = this.hazards.create(
      midX,
      this.groundY + 3,
      'pit-void',
    ) as Phaser.Physics.Arcade.Image
    rimBar.setDisplaySize(widthPx + 16, 10 * s)
    rimBar.setTint(0xf87171)
    const rBody = rimBar.body as Phaser.Physics.Arcade.Body
    rBody.enable = false
    rimBar.setDepth(7)
    rimBar.setData('meta', { ...pitMetaBase })
    this.tweens.add({
      targets: rimBar,
      alpha: { from: 0.7, to: 1 },
      duration: 280,
      yoyo: true,
      repeat: -1,
    })

    // Left / right danger posts
    for (const edgeX of [left - 4, right + 4]) {
      const post = this.hazards.create(
        edgeX,
        this.groundY - 14 * s,
        'pit-rim',
      ) as Phaser.Physics.Arcade.Image
      post.setDisplaySize(12 * s, 36 * s)
      const pBody = post.body as Phaser.Physics.Arcade.Body
      pBody.enable = false
      post.setDepth(8)
      post.setData('meta', { ...pitMetaBase })
    }

    // Spike teeth — only *inside* the pit (not on approach/landing floor)
    const spikeH = 36 * s
    const spikeW = 34
    const count = Math.max(3, Math.floor(widthPx / (spikeW * 0.85)))
    for (let i = 0; i < count; i++) {
      const sx = left + spikeW * 0.55 + i * (widthPx / count)
      if (sx < left + 8 || sx > right - 8) continue
      const spike = this.hazards.create(
        sx,
        this.groundY + spikeH * 0.15,
        'spike',
      ) as Phaser.Physics.Arcade.Image
      this.fitHazardBody(spike, spikeW, spikeH, 0.72, 0.88)
      spike.setImmovable(true)
      spike.setDepth(5)
      spike.setTint(0xfca5a5)
      spike.setData('meta', {
        kind: 'spike',
        scored: false,
        dangerTop: this.groundY,
        dangerBottom: this.groundY + spikeH,
        lane: 'ground',
      } satisfies HazardMeta)
      attachQuantumPulse(this, spike)
    }

    // Scorer marker so clearing the pit awards combo
    const marker = this.hazards.create(midX, this.groundY - 8, 'pit-void') as Phaser.Physics.Arcade.Image
    marker.setDisplaySize(widthPx, 12)
    marker.setAlpha(0.01)
    const mBody = marker.body as Phaser.Physics.Arcade.Body
    mBody.enable = false
    marker.setDepth(1)
    marker.setData('meta', { ...pitMetaBase })
    marker.setData('pitClear', true)
  }

  /**
   * Elevated runway — double-jump up, run over ground hazards, drop off the end.
   * Surface Y is the *top* of the tiles so feet sit on the deck, not through it.
   */
  private spawnHighRunway() {
    const s = this.softH()
    const rise = LEDGER_RUNNER.platformRise * s
    /** Walkable surface (top edge of runway tiles). */
    const surfaceY = this.groundY - rise
    const tileH = 18 * s
    const len = Phaser.Math.Between(
      Math.round(LEDGER_RUNNER.platformMinLen * s),
      Math.round(LEDGER_RUNNER.platformMaxLen * s),
    )
    const tileW = 56 * s
    const tiles = Math.max(5, Math.ceil(len / tileW))
    const startX = this.scale.width + 50
    const setLeft = startX - tileW / 2
    const setRight = startX + (tiles - 1) * tileW + tileW / 2

    for (let i = 0; i < tiles; i++) {
      const x = startX + i * tileW
      // Center so the *top* of the sprite is exactly surfaceY
      const tile = this.hazards.create(
        x,
        surfaceY + tileH / 2,
        'runway',
      ) as Phaser.Physics.Arcade.Image
      tile.setDisplaySize(tileW + 2, tileH)
      const body = tile.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.enable = false // floor resolved manually — not a damage hitbox
      tile.setDepth(8)
      tile.setData('meta', {
        kind: 'platform',
        scored: false,
        dangerTop: surfaceY - 20,
        dangerBottom: surfaceY + tileH,
        lane: 'high',
        noDamage: true,
        isPlatform: true,
        platformTop: surfaceY,
        platformLeft: setLeft,
        platformRight: setRight,
      } satisfies HazardMeta)
    }

    // Fill under the runway with ground hazards + floaters (safe if you stay up top)
    const span = setRight - setLeft
    const mid = (setLeft + setRight) / 2
    this.time.delayedCall(60, () => {
      if (this.state !== 'playing') return

      // Spikes on the floor under the bridge
      const spikeCount = 2 + Math.floor(span / (140 * s))
      for (let i = 0; i < spikeCount; i++) {
        const sx =
          setLeft +
          40 * s +
          (i + 0.5) * ((span - 80 * s) / spikeCount)
        const h = 32 * s
        const spike = this.hazards.create(
          sx,
          this.groundY - h / 2,
          'spike',
        ) as Phaser.Physics.Arcade.Image
        this.fitHazardBody(spike, 36, h, 0.7, 0.85)
        spike.setImmovable(true)
        spike.setDepth(6)
        spike.setData('meta', {
          kind: 'spike',
          scored: false,
          dangerTop: this.groundY - h,
          dangerBottom: this.groundY,
          lane: 'ground',
        } satisfies HazardMeta)
      }

      // Short crawl blocks that stay *under* the deck (never pierce the platform)
      const gap = 25 * s
      const bottom = this.groundY - gap
      // Top of hazard must stay below surfaceY with clear air gap
      const maxTop = surfaceY + 20 * s
      const maxH = Math.max(36 * s, bottom - maxTop)
      const bh = Math.min(70 * s, maxH)
      if (bh > 40 * s) {
        const beam = this.hazards.create(
          mid + 20 * s,
          bottom - bh / 2,
          'lowbeam',
        ) as Phaser.Physics.Arcade.Image
        this.fitHazardBody(beam, 48, bh, 0.9, 0.95)
        beam.setImmovable(true)
        beam.setDepth(4) // under runway (depth 8)
        beam.setData('meta', {
          kind: 'lowbeam',
          scored: false,
          dangerTop: bottom - bh,
          dangerBottom: bottom,
          lane: 'ground',
          requiresSlide: true,
        } satisfies HazardMeta)
      }

      // Floating orbs strictly between floor spikes and the deck underside
      const deckClear = surfaceY + tileH + 12 * s // below platform bottom
      const airCount = 2 + Math.floor(span / (180 * s))
      for (let i = 0; i < airCount; i++) {
        const fx =
          setLeft +
          50 * s +
          (i + 0.5) * ((span - 100 * s) / airCount)
        const minAir = this.groundY - Math.round(rise - 22 * s)
        const maxAir = this.groundY - Math.round(48 * s)
        // Keep floaters under the platform slab
        const midAir = Phaser.Math.Clamp(
          Phaser.Math.Between(Math.min(minAir, maxAir), Math.max(minAir, maxAir)),
          deckClear,
          this.groundY - 40 * s,
        )
        const size = 28 * s
        const floater = this.hazards.create(
          fx,
          midAir,
          'floater',
        ) as Phaser.Physics.Arcade.Image
        floater.setDisplaySize(size, size)
        const fBody = floater.body as Phaser.Physics.Arcade.Body
        const frameW = floater.frame.width
        const sourceR = frameW * 0.35
        fBody.setCircle(sourceR)
        fBody.setOffset((frameW - sourceR * 2) / 2, (frameW - sourceR * 2) / 2)
        fBody.setAllowGravity(false)
        fBody.updateFromGameObject()
        floater.setImmovable(true)
        floater.setDepth(4)
        floater.setData('floatPhase', Math.random() * Math.PI * 2)
        floater.setData('floatBase', midAir)
        floater.setData('floatAmp', Phaser.Math.Between(6, 12) * s)
        floater.setData('meta', {
          kind: 'floater',
          scored: false,
          dangerTop: midAir - 18 * s,
          dangerBottom: midAir + 18 * s,
          lane: 'ground',
        } satisfies HazardMeta)
        attachQuantumPulse(this, floater)
      }
    })
  }

  private updateHazards(delta: number) {
    const dx = this.scrollSpeed * (delta / 1000)
    const children = this.hazards.getChildren() as Phaser.Physics.Arcade.Image[]

    for (const haz of children) {
      haz.x -= dx

      // Scroll platform / pit bounds with the world
      const metaMove = haz.getData('meta') as HazardMeta | undefined
      if (metaMove?.isPlatform && metaMove.platformLeft != null) {
        metaMove.platformLeft -= dx
        metaMove.platformRight = (metaMove.platformRight ?? 0) - dx
      }
      if (metaMove?.isPit && metaMove.pitLeft != null) {
        metaMove.pitLeft -= dx
        metaMove.pitRight = (metaMove.pitRight ?? 0) - dx
      }

      // Floater / powerup bob
      if (haz.texture.key === 'floater' || haz.texture.key === 'powerup') {
        const phase = (haz.getData('floatPhase') as number) + delta / 280
        haz.setData('floatPhase', phase)
        const base = haz.getData('floatBase') as number
        const amp = (haz.getData('floatAmp') as number) ?? 12
        haz.y = base + Math.sin(phase) * amp
      }

      const body = haz.body as Phaser.Physics.Arcade.Body | null
      if (body && body.enable) {
        body.updateFromGameObject()
      }

      const meta = haz.getData('meta') as HazardMeta | undefined
      if (!meta || meta.scored) continue

      // Pit clear (score once when fully past the hole)
      if (meta.isPit && haz.getData('pitClear')) {
        const right = meta.pitRight ?? haz.x + haz.displayWidth / 2
        if (right < this.player.x - 12) {
          meta.scored = true
          const perfect = meta.needsDoubleJump
            ? true // wide gap that needed two hops
            : true
          this.registerClear(perfect)
          floatScoreText(
            this,
            this.player.x + 28,
            this.player.y - 36,
            meta.needsDoubleJump ? 'LONG JUMP!' : 'PIT CLEAR',
            meta.needsDoubleJump ? '#22d3ee' : '#d4922a',
          )
        }
        continue
      }

      if (meta.isPlatform || meta.isPowerup || meta.noDamage || meta.isPit) continue

      // Cleared when fully past the runner
      if (haz.x + haz.displayWidth / 2 < this.player.x - 12) {
        meta.scored = true

        const feet =
          this.player.y + (this.player.body as Phaser.Physics.Arcade.Body).halfHeight
        let perfect = false

        if (meta.kind === 'spike') {
          // Pit spikes sit below the floor — no jump-clear bonus
          if (meta.dangerTop >= this.groundY - 2) {
            meta.scored = true
            continue
          }
          perfect = feet < meta.dangerTop - 8 || this.onPlatform
        } else if (meta.kind === 'barrier' || meta.kind === 'lowbeam') {
          perfect = this.isSliding || this.onPlatform
        } else {
          const mid = (meta.dangerTop + meta.dangerBottom) / 2
          perfect = Math.abs(this.player.y - mid) > 28
        }

        if (meta.lane === 'ground' && this.onPlatform) {
          this.registerClear(true)
        } else {
          this.registerClear(perfect)
        }
      }
    }
  }

  private cullHazards() {
    const children = this.hazards.getChildren() as Phaser.Physics.Arcade.Image[]
    for (const haz of children) {
      if (haz.x < -100) {
        haz.destroy()
      }
    }
  }

  // ── bridge ─────────────────────────────────────────────

  private getBridge(): LedgerRunnerBridge | null {
    const bridge = this.game.registry.get('ledgerRunnerBridge') as
      | LedgerRunnerBridge
      | undefined
    return bridge ?? null
  }

  private emitScore(score: number) {
    this.getBridge()?.onScoreChange(score)
  }

  private emitState(state: LedgerRunnerGameState) {
    this.getBridge()?.onStateChange(state)
  }
}
