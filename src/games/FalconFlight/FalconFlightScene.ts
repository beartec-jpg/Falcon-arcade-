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

type ObstacleKind = 'ledger' | 'quantum' | 'float' | 'weave'

type ObstacleMeta = {
  kind: ObstacleKind
  scored: boolean
  gapCenterY?: number
  gapHalf?: number
  /** Shared id so multi-piece sets only award one clear bonus */
  setId?: number
}

type GateBias = 'high' | 'mid' | 'low' | 'random'

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
      () => this.handleCrash(),
      undefined,
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
          'Weave through ledger gaps — placement varies every column.',
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
    this.createOverlay()
    const title = this.overlay.getData('title') as Phaser.GameObjects.Text
    const body = this.overlay.getData('body') as Phaser.GameObjects.Text
    const cta = this.overlay.getData('cta') as Phaser.GameObjects.Text
    if (mode === 'ready') {
      title.setText('Falcon Flight')
      body.setText(
        'Fly forward automatically. Touch above/below the falcon (or ↑↓) to weave through randomized ledger gaps.',
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
  }

  private hideOverlay() {
    if (this.overlay) this.overlay.setVisible(false)
  }

  // ── lifecycle ──────────────────────────────────────────

  private resetRun(_preserveBest: boolean) {
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
    this.pointerUpHeld = false
    this.pointerDownHeld = false
    this.touchZone = 'none'
    this.falcon.setPosition(FALCON_FLIGHT.playerX, this.scale.height / 2)
    this.falcon.setVelocity(0, 0)
    this.falconVisual.setPosition(this.falcon.x, this.falcon.y)
    this.falconVisual.setAlpha(1)
    this.falconVisual.setAngle(0)
    this.hudScore.setText('SCORE  0')
    this.hudScore.setColor('#f1f5f9')
    this.emitScore(0)
  }

  private beginRun() {
    if (this.waitingHowTo) return
    this.state = 'playing'
    this.hideOverlay()
    this.nextSpawnAt = this.time.now + 700
    this.lastGapCenterY = this.falcon.y
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

    playDeathJuice(
      this,
      this.falcon.x,
      this.falcon.y,
      this.difficulty,
      this.deathEmitter,
    )

    this.tweens.add({
      targets: this.falconVisual,
      alpha: 0.2,
      angle: 22,
      duration: 280,
      ease: 'Quad.easeOut',
    })

    this.time.delayedCall(340, () => {
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

  private spawnObstaclesIfNeeded() {
    if (this.time.now < this.nextSpawnAt) return
    const interval = Phaser.Math.Linear(
      FALCON_FLIGHT.spawnMaxMs,
      FALCON_FLIGHT.spawnMinMs,
      this.difficulty,
    )

    // Weighted variety — more weave/float as difficulty rises
    const roll = Math.random()
    const d = this.difficulty
    if (roll < 0.14 + d * 0.1) {
      this.spawnQuantumBarrier()
    } else if (roll < 0.28 + d * 0.12) {
      this.spawnFloatingBlock()
    } else if (roll < 0.42 + d * 0.14) {
      this.spawnWeaveGates()
    } else if (roll < 0.55) {
      this.spawnLedgerPair(this.currentGapHeight(true), this.pickBias(['high', 'low']))
    } else {
      this.spawnLedgerPair(this.currentGapHeight(false), this.pickBias(['high', 'mid', 'low', 'random']))
    }

    this.nextSpawnAt =
      this.time.now + interval * Phaser.Math.FloatBetween(0.88, 1.12)
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
      const bar = this.obstacles.create(
        x,
        seg.y,
        'quantum-bar',
      ) as Phaser.Physics.Arcade.Image
      // Hitboxes match visuals more closely — less “ghosting” through bars
      this.fitObstacleBody(bar, barW, seg.h, 0.88, 0.94)
      bar.setData('meta', meta)
      bar.setDepth(5)
      bar.setImmovable(true)
      attachQuantumPulse(this, bar)
    }
  }

  private spawnScaledBlock(
    x: number,
    y: number,
    w: number,
    h: number,
    kind: ObstacleKind,
  ) {
    const key =
      kind === 'quantum' ? 'quantum-bar' : 'ledger-block'
    const block = this.obstacles.create(x, y, key) as Phaser.Physics.Arcade.Image
    this.fitObstacleBody(block, w, h, 0.88, 0.94)
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

  private updateObstacles(delta: number) {
    const dx = this.scrollSpeed * (delta / 1000)
    const children = this.obstacles.getChildren() as Phaser.Physics.Arcade.Image[]

    for (const obs of children) {
      obs.x -= dx
      const body = obs.body as Phaser.Physics.Arcade.Body | null
      if (body) {
        body.x = obs.x - body.halfWidth
        body.y = obs.y - body.halfHeight
      }

      const meta = obs.getData('meta') as ObstacleMeta | undefined
      if (!meta || meta.scored) continue

      if (obs.x + obs.displayWidth / 2 < this.falcon.x - 8) {
        meta.scored = true
        const bonus = FALCON_FLIGHT.gapPassBonus
        this.addScore(bonus)

        // Near-miss if falcon is close to gap edge
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
