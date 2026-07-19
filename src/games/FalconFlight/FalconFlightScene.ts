import Phaser from 'phaser'
import {
  FALCON_COLORS,
  FALCON_FLIGHT,
  FALCON_FLIGHT_REWARD_THRESHOLD,
  type FalconFlightBridge,
  type FalconFlightGameState,
} from './falconFlightConfig'

type ObstacleKind = 'ledger' | 'quantum'

type ObstacleMeta = {
  kind: ObstacleKind
  scored: boolean
  gapCenterY?: number
  gapHalf?: number
}

/**
 * Falcon Flight — horizontal auto-scroller.
 * Player controls vertical movement only; world scrolls left.
 */
export class FalconFlightScene extends Phaser.Scene {
  private state: FalconFlightGameState = 'ready'
  private score = 0
  private distanceAccumulator = 0
  private scrollSpeed: number = FALCON_FLIGHT.baseScrollSpeed
  private difficulty = 0
  private nextSpawnAt = 0
  private elapsedPlayMs = 0

  private falcon!: Phaser.Physics.Arcade.Image
  private falconVisual!: Phaser.GameObjects.Container
  private obstacles!: Phaser.Physics.Arcade.Group
  private stars!: Phaser.GameObjects.Graphics
  private starOffsets: { x: number; y: number; s: number; a: number }[] = []

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyW!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyUp!: Phaser.Input.Keyboard.Key
  private keyDown!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key

  private pointerUpHeld = false
  private pointerDownHeld = false
  private touchZone: 'none' | 'up' | 'down' = 'none'

  private hudScore!: Phaser.GameObjects.Text
  private hudHint!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Container
  private deathEmitter!: Phaser.GameObjects.Particles.ParticleEmitter

  private wingFlap = 0

  constructor() {
    super('FalconFlightScene')
  }

  create() {
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor(FALCON_COLORS.bgHex)
    this.createStarfield(width, height)
    this.createTextures()

    this.obstacles = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    })

    this.falconVisual = this.createFalconVisual()
    this.falcon = this.physics.add.image(
      FALCON_FLIGHT.playerX,
      height / 2,
      'falcon-hitbox',
    )
    this.falcon.setVisible(false)
    // setCircle radius is in unscaled texture space (texture is 32×32).
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

    this.setupInput()
    this.createHud(width, height)
    this.createDeathParticles()
    this.resetRun(false)
    this.showOverlay('ready')
    this.emitState('ready')
    this.emitScore(0)
  }

  update(_time: number, delta: number) {
    this.scrollStarfield(delta)
    this.updateFalconVisual(delta)
    this.readVerticalInput()

    if (this.state === 'ready') {
      this.bobFalconIdle(delta)
      if (this.wantsStart()) {
        this.beginRun()
      }
      return
    }

    if (this.state === 'gameover') {
      if (this.wantsStart()) {
        this.resetRun(true)
        this.beginRun()
      }
      return
    }

    // playing
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

    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 1)
      g.fillCircle(4, 4, 4)
      g.generateTexture('spark', 8, 8)
      g.destroy()
    }

    if (!this.textures.exists('ledger-block')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 64
      const h = 64
      g.fillStyle(FALCON_COLORS.ledgerFace, 1)
      g.fillRoundedRect(0, 0, w, h, 6)
      g.lineStyle(2, FALCON_COLORS.bronze, 0.85)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 6)
      // faux ledger lines
      g.lineStyle(1, FALCON_COLORS.bronzeDark, 0.55)
      for (let y = 14; y < h - 8; y += 10) {
        g.lineBetween(10, y, w - 10, y)
      }
      g.generateTexture('ledger-block', w, h)
      g.destroy()
    }

    if (!this.textures.exists('quantum-bar')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const w = 28
      const h = 64
      g.fillStyle(FALCON_COLORS.quantumDim, 0.95)
      g.fillRect(0, 0, w, h)
      g.lineStyle(2, FALCON_COLORS.quantum, 0.9)
      g.strokeRect(1, 1, w - 2, h - 2)
      // static hatch
      g.lineStyle(1, FALCON_COLORS.quantum, 0.45)
      for (let i = -h; i < w + h; i += 8) {
        g.lineBetween(i, 0, i + h, h)
      }
      g.generateTexture('quantum-bar', w, h)
      g.destroy()
    }
  }

  private createFalconVisual() {
    const container = this.add.container(FALCON_FLIGHT.playerX, this.scale.height / 2)
    container.setDepth(11)

    // Tail feathers
    const tail = this.add.triangle( -18, 0, 0, -8, 0, 8, -16, 0, FALCON_COLORS.bronzeDark)
    // Body chevron (pointing right)
    const body = this.add.triangle(2, 0, -14, -12, -14, 12, 22, 0, FALCON_COLORS.bronze)
    // Wing top
    const wingTop = this.add.triangle(-2, -10, -10, 0, 8, -2, -4, -22, FALCON_COLORS.bronzeBright)
    // Wing bottom
    const wingBot = this.add.triangle(-2, 10, -10, 0, 8, 2, -4, 22, FALCON_COLORS.bronzeDark)
    // Head accent
    const head = this.add.circle(14, -2, 5, FALCON_COLORS.bronzeBright)
    const beak = this.add.triangle(22, 0, 0, -3, 0, 3, 10, 0, FALCON_COLORS.bronzeBright)
    // Eye
    const eye = this.add.circle(16, -3, 1.6, 0x020617)

    // Soft glow
    const glow = this.add.circle(0, 0, 22, FALCON_COLORS.bronze, 0.12)

    container.add([glow, tail, wingBot, wingTop, body, head, beak, eye])
    container.setData('wingTop', wingTop)
    container.setData('wingBot', wingBot)
    return container
  }

  private createStarfield(width: number, height: number) {
    this.stars = this.add.graphics().setDepth(0)
    this.starOffsets = []
    for (let i = 0; i < 48; i += 1) {
      this.starOffsets.push({
        x: Phaser.Math.Between(0, width),
        y: Phaser.Math.Between(0, height),
        s: Phaser.Math.FloatBetween(0.6, 2.2),
        a: Phaser.Math.FloatBetween(0.25, 0.85),
      })
    }
    this.drawStars()

    // Horizon grid line (ledger aesthetic)
    const grid = this.add.graphics().setDepth(1).setAlpha(0.2)
    grid.lineStyle(1, FALCON_COLORS.bronze, 0.35)
    for (let y = 0; y < height; y += 54) {
      grid.lineBetween(0, y, width, y)
    }
  }

  private drawStars() {
    const { width } = this.scale
    this.stars.clear()
    for (const star of this.starOffsets) {
      this.stars.fillStyle(FALCON_COLORS.star, star.a)
      this.stars.fillCircle(star.x % width, star.y, star.s)
    }
  }

  private scrollStarfield(delta: number) {
    const drift = (this.state === 'playing' ? this.scrollSpeed : 40) * (delta / 1000) * 0.35
    const { width } = this.scale
    for (const star of this.starOffsets) {
      star.x -= drift * (0.4 + star.s * 0.3)
      if (star.x < 0) star.x += width
    }
    this.drawStars()
  }

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
      this.keyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
      this.keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.state === 'ready') {
        this.beginRun()
        return
      }
      if (this.state === 'gameover') {
        this.resetRun(true)
        this.beginRun()
        return
      }

      this.updateTouchZone(pointer.y)
      if (pointer.y < this.scale.height / 2) {
        this.pointerUpHeld = true
        this.pointerDownHeld = false
      } else {
        this.pointerDownHeld = true
        this.pointerUpHeld = false
      }
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return
      this.updateTouchZone(pointer.y)
      if (pointer.y < this.scale.height / 2) {
        this.pointerUpHeld = true
        this.pointerDownHeld = false
      } else {
        this.pointerDownHeld = true
        this.pointerUpHeld = false
      }
    })
    this.input.on('pointerup', () => {
      this.pointerUpHeld = false
      this.pointerDownHeld = false
      this.touchZone = 'none'
    })
  }

  private updateTouchZone(y: number) {
    this.touchZone = y < this.scale.height / 2 ? 'up' : 'down'
  }

  private createHud(width: number, height: number) {
    this.hudScore = this.add
      .text(20, 16, 'SCORE  0', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '22px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setDepth(30)
      .setScrollFactor(0)

    this.add
      .text(20, 44, `THRESHOLD  ${FALCON_FLIGHT_REWARD_THRESHOLD}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
        color: '#94a3b8',
        fontStyle: '600',
      })
      .setDepth(30)
      .setScrollFactor(0)

    this.hudHint = this.add
      .text(width / 2, height - 28, '↑↓ / W S  ·  touch top/bottom half  ·  SPACE to start', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setScrollFactor(0)

    // Subtle top/bottom touch affordance bands
    const bandAlpha = 0.04
    this.add
      .rectangle(width / 2, height * 0.12, width, height * 0.24, FALCON_COLORS.bronze, bandAlpha)
      .setDepth(2)
    this.add
      .rectangle(width / 2, height * 0.88, width, height * 0.24, FALCON_COLORS.quantum, bandAlpha)
      .setDepth(2)
  }

  private createDeathParticles() {
    this.deathEmitter = this.add.particles(0, 0, 'spark', {
      lifespan: 650,
      speed: { min: 80, max: 260 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [FALCON_COLORS.bronzeBright, FALCON_COLORS.bronze, FALCON_COLORS.quantum],
      emitting: false,
      blendMode: 'ADD',
      quantity: 24,
    })
    this.deathEmitter.setDepth(20)
  }

  private createOverlay() {
    if (this.overlay) {
      this.overlay.destroy(true)
    }

    const { width, height } = this.scale
    const container = this.add.container(width / 2, height / 2).setDepth(40)
    const panel = this.add
      .rectangle(0, 0, 420, 210, FALCON_COLORS.panel, 0.94)
      .setStrokeStyle(2, FALCON_COLORS.bronze, 0.7)

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
      if (this.state === 'ready') {
        this.beginRun()
      } else if (this.state === 'gameover') {
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
        'Fly forward automatically. Steer up and down to slip through ledger gaps and dodge quantum static.',
      )
      cta.setText('TAP / SPACE TO LAUNCH')
    } else {
      title.setText('Signal Lost')
      body.setText(
        `Final score  ${this.score}\nClear ${FALCON_FLIGHT_REWARD_THRESHOLD} points to unlock the Game Faucet claim.`,
      )
      cta.setText('TAP / SPACE TO RESTART')
    }

    this.overlay.setVisible(true)
    this.hudHint.setText(
      mode === 'ready'
        ? '↑↓ / W S  ·  touch top/bottom half  ·  SPACE to start'
        : 'SPACE or tap to restart',
    )
  }

  private hideOverlay() {
    if (this.overlay) {
      this.overlay.setVisible(false)
    }
  }

  // ── run lifecycle ──────────────────────────────────────

  private resetRun(preserveBest: boolean) {
    void preserveBest
    this.state = 'ready'
    this.score = 0
    this.distanceAccumulator = 0
    this.scrollSpeed = FALCON_FLIGHT.baseScrollSpeed
    this.difficulty = 0
    this.elapsedPlayMs = 0
    this.nextSpawnAt = 0

    this.obstacles.clear(true, true)
    this.falcon.setPosition(FALCON_FLIGHT.playerX, this.scale.height / 2)
    this.falcon.setVelocity(0, 0)
    this.falconVisual.setPosition(this.falcon.x, this.falcon.y)
    this.falconVisual.setAlpha(1)
    this.falconVisual.setAngle(0)

    this.hudScore.setText('SCORE  0')
    this.emitScore(0)
  }

  private beginRun() {
    this.state = 'playing'
    this.hideOverlay()
    this.nextSpawnAt = this.time.now + 700
    this.hudHint.setText('Steer clear of ledger blocks & quantum static')
    this.emitState('playing')
  }

  private handleCrash() {
    if (this.state !== 'playing') return

    this.state = 'gameover'
    this.falcon.setVelocity(0, 0)

    this.deathEmitter.setPosition(this.falcon.x, this.falcon.y)
    this.deathEmitter.explode(28)
    this.cameras.main.shake(280, 0.012)
    this.cameras.main.flash(120, 192, 120, 56, false)

    this.tweens.add({
      targets: this.falconVisual,
      alpha: 0.25,
      angle: 18,
      duration: 240,
      ease: 'Quad.easeOut',
    })

    this.showOverlay('gameover')
    this.emitState('gameover')
    this.emitScore(this.score)
  }

  // ── movement & scoring ─────────────────────────────────

  private readVerticalInput() {
    // Pointer state already tracked via events.
  }

  private verticalIntent(): number {
    let dir = 0
    if (this.cursors?.up.isDown || this.keyW?.isDown || this.keyUp?.isDown) dir -= 1
    if (this.cursors?.down.isDown || this.keyS?.isDown || this.keyDown?.isDown) dir += 1
    if (this.pointerUpHeld || this.touchZone === 'up') dir -= 1
    if (this.pointerDownHeld || this.touchZone === 'down') dir += 1
    return Phaser.Math.Clamp(dir, -1, 1)
  }

  private wantsStart(): boolean {
    const spaceJust =
      this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)
    // pointerdown on overlay handled separately; also allow anywhere when ready/gameover
    return Boolean(spaceJust)
  }

  private applyVerticalMovement() {
    const intent = this.verticalIntent()
    this.falcon.setVelocityY(intent * FALCON_FLIGHT.verticalSpeed)

    // Soft clamp inside playfield padding
    const pad = 28
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
    if (!this.falconVisual || !this.falcon) return

    this.falconVisual.x = this.falcon.x
    this.falconVisual.y = this.falcon.y

    if (this.state === 'playing') {
      const vy = this.falcon.body?.velocity.y ?? 0
      const targetAngle = Phaser.Math.Clamp(vy / 18, -22, 22)
      this.falconVisual.angle = Phaser.Math.Linear(
        this.falconVisual.angle,
        targetAngle,
        0.2,
      )
      this.wingFlap += delta * (1 + this.difficulty)
      const flap = Math.sin(this.wingFlap / 90) * 4
      const wingTop = this.falconVisual.getData('wingTop') as Phaser.GameObjects.Triangle
      const wingBot = this.falconVisual.getData('wingBot') as Phaser.GameObjects.Triangle
      wingTop.y = -10 - flap
      wingBot.y = 10 + flap
    }
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
    if (this.score !== prev) {
      this.hudScore.setText(`SCORE  ${this.score}`)
      if (
        this.score >= FALCON_FLIGHT_REWARD_THRESHOLD &&
        prev < FALCON_FLIGHT_REWARD_THRESHOLD
      ) {
        this.hudScore.setColor('#d4922a')
        this.cameras.main.flash(80, 208, 146, 42, false)
      }
      this.emitScore(this.score)
    }
  }

  // ── obstacles ──────────────────────────────────────────

  private spawnObstaclesIfNeeded() {
    if (this.time.now < this.nextSpawnAt) return

    const gap = Phaser.Math.Linear(
      FALCON_FLIGHT.gapMax,
      FALCON_FLIGHT.gapMin,
      this.difficulty,
    )
    const interval = Phaser.Math.Linear(
      FALCON_FLIGHT.spawnMaxMs,
      FALCON_FLIGHT.spawnMinMs,
      this.difficulty,
    )

    // Mix ledger pairs with occasional quantum static columns
    if (Math.random() < 0.28 + this.difficulty * 0.15) {
      this.spawnQuantumBarrier()
    } else {
      this.spawnLedgerPair(gap)
    }

    this.nextSpawnAt = this.time.now + interval * Phaser.Math.FloatBetween(0.85, 1.1)
  }

  private spawnLedgerPair(gapHeight: number) {
    const { width, height } = this.scale
    const x = width + 50
    const margin = 50
    const gapCenter = Phaser.Math.Between(
      margin + gapHeight / 2,
      height - margin - gapHeight / 2,
    )
    const topBottom = gapCenter - gapHeight / 2
    const bottomTop = gapCenter + gapHeight / 2
    const blockWidth = 58

    const topHeight = Math.max(24, topBottom)
    const bottomHeight = Math.max(24, height - bottomTop)

    const top = this.spawnScaledBlock(x, topHeight / 2, blockWidth, topHeight, 'ledger')
    const bottom = this.spawnScaledBlock(
      x,
      bottomTop + bottomHeight / 2,
      blockWidth,
      bottomHeight,
      'ledger',
    )

    const meta: ObstacleMeta = {
      kind: 'ledger',
      scored: false,
      gapCenterY: gapCenter,
      gapHalf: gapHeight / 2,
    }
    top.setData('meta', meta)
    bottom.setData('meta', meta)
    // Share one meta object so scoring only fires once for the pair
  }

  private spawnQuantumBarrier() {
    const { width, height } = this.scale
    const x = width + 40
    // Keep slots fairly generous so “ghost” collisions don’t feel unfair
    const slotH = Phaser.Math.Linear(140, 95, this.difficulty)
    const slotCenter = Phaser.Math.Between(90, height - 90)
    const barW = 26

    const topH = Math.max(20, slotCenter - slotH / 2)
    const botY = slotCenter + slotH / 2
    const botH = Math.max(20, height - botY)
    const segments: { y: number; h: number }[] = [
      { y: topH / 2, h: topH },
      { y: botY + botH / 2, h: botH },
    ]

    const meta: ObstacleMeta = {
      kind: 'quantum',
      scored: false,
      gapCenterY: slotCenter,
      gapHalf: slotH / 2,
    }

    for (const seg of segments) {
      const bar = this.obstacles.create(x, seg.y, 'quantum-bar') as Phaser.Physics.Arcade.Image
      this.fitObstacleBody(bar, barW, seg.h, 0.78, 0.9)
      bar.setData('meta', meta)
      bar.setDepth(5)
      bar.setImmovable(true)
    }
  }

  private spawnScaledBlock(
    x: number,
    y: number,
    w: number,
    h: number,
    kind: ObstacleKind,
  ) {
    const key = kind === 'ledger' ? 'ledger-block' : 'quantum-bar'
    const block = this.obstacles.create(x, y, key) as Phaser.Physics.Arcade.Image
    // Hitbox slightly tighter than the art so gaps feel honest
    this.fitObstacleBody(block, w, h, 0.78, 0.9)
    block.setImmovable(true)
    block.setDepth(5)
    return block
  }

  /**
   * Phaser Arcade `body.setSize` is in *unscaled texture* units, then multiplied
   * by the sprite’s scale. Passing display-pixel sizes made hitboxes huge
   * (ghost collisions past the visible ledge/barrier).
   */
  private fitObstacleBody(
    obj: Phaser.Physics.Arcade.Image,
    displayW: number,
    displayH: number,
    hitScaleX = 0.8,
    hitScaleY = 0.9,
  ) {
    obj.setDisplaySize(displayW, displayH)

    const body = obj.body as Phaser.Physics.Arcade.Body
    const frameW = obj.frame.width
    const frameH = obj.frame.height

    // World hitbox ≈ display * hitScale; convert to pre-scale source size.
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
      // Keep body centered with the sprite while scrolling
      obs.x -= dx
      const body = obs.body as Phaser.Physics.Arcade.Body | null
      if (body) {
        body.x = obs.x - body.halfWidth
        body.y = obs.y - body.halfHeight
      }

      const meta = obs.getData('meta') as ObstacleMeta | undefined
      if (!meta || meta.scored) continue

      // Score when obstacle center passes behind the falcon
      if (obs.x + (obs.displayWidth / 2) < this.falcon.x - 8) {
        meta.scored = true
        this.addScore(FALCON_FLIGHT.gapPassBonus)
        this.tweens.add({
          targets: this.hudScore,
          scale: 1.12,
          duration: 80,
          yoyo: true,
        })
      }
    }
  }

  private cullObstacles() {
    const children = this.obstacles.getChildren() as Phaser.Physics.Arcade.Image[]
    for (const obs of children) {
      if (obs.x < -80) {
        obs.destroy()
      }
    }
  }

  // ── bridge ─────────────────────────────────────────────

  private getBridge(): FalconFlightBridge | null {
    const bridge = this.game.registry.get('falconFlightBridge') as
      | FalconFlightBridge
      | undefined
    return bridge ?? null
  }

  private emitScore(score: number) {
    this.getBridge()?.onScoreChange(score)
  }

  private emitState(state: FalconFlightGameState) {
    this.getBridge()?.onStateChange(state)
  }
}
