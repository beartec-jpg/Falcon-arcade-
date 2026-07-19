import Phaser from 'phaser'
import {
  LEDGER_RUNNER,
  LEDGER_RUNNER_REWARD_THRESHOLD,
  RUNNER_COLORS,
  type LedgerRunnerBridge,
  type LedgerRunnerGameState,
} from './ledgerRunnerConfig'

type HazardKind = 'spike' | 'barrier' | 'floater'

type HazardMeta = {
  kind: HazardKind
  scored: boolean
  /** Vertical band the runner must avoid (for perfect-clear checks). */
  dangerTop: number
  dangerBottom: number
}

/**
 * Ledger Runner — horizontal auto-runner.
 * Auto-scrolls forward; player jumps (and optional double-jump / slide).
 */
export class LedgerRunnerScene extends Phaser.Scene {
  private state: LedgerRunnerGameState = 'ready'
  private score = 0
  private combo = 0
  private distanceAccumulator = 0
  private scrollSpeed: number = LEDGER_RUNNER.baseScrollSpeed
  private difficulty = 0
  private nextSpawnAt = 0
  private elapsedPlayMs = 0

  private player!: Phaser.Physics.Arcade.Image
  private playerVisual!: Phaser.GameObjects.Container
  private hazards!: Phaser.Physics.Arcade.Group
  private groundY = LEDGER_RUNNER.groundY

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

  private stars!: Phaser.GameObjects.Graphics
  private starOffsets: { x: number; y: number; s: number; a: number }[] = []
  private groundGfx!: Phaser.GameObjects.Graphics
  private groundScroll = 0

  private hudScore!: Phaser.GameObjects.Text
  private hudCombo!: Phaser.GameObjects.Text
  private hudHint!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Container
  private deathEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private runBob = 0

  constructor() {
    super('LedgerRunnerScene')
  }

  create() {
    const { width, height } = this.scale
    this.groundY = LEDGER_RUNNER.groundY

    this.cameras.main.setBackgroundColor(RUNNER_COLORS.bgHex)
    this.physics.world.gravity.y = LEDGER_RUNNER.gravityY
    this.physics.world.setBounds(0, 0, width, height)

    this.createStarfield(width)
    this.createGround(width)
    this.createTextures()

    this.hazards = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    })

    this.playerVisual = this.createRunnerVisual()
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
      () => this.handleCrash(),
      undefined,
      this,
    )

    this.setupInput()
    this.createHud(width, height)
    this.createDeathParticles()
    this.resetRun()
    this.showOverlay('ready')
    this.emitState('ready')
    this.emitScore(0)
  }

  update(_time: number, delta: number) {
    this.scrollStarfield(delta)
    this.drawGround(delta)
    this.syncPlayerVisual(delta)
    this.updateGrounded()

    if (this.state === 'ready') {
      this.idleBob(delta)
      if (this.consumeJumpPress() || this.consumeStartPress()) {
        this.beginRun()
      }
      return
    }

    if (this.state === 'gameover') {
      if (this.consumeJumpPress() || this.consumeStartPress()) {
        this.resetRun()
        this.beginRun()
      }
      return
    }

    // playing
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

    this.handleSlideInput()
    if (this.consumeJumpPress()) {
      this.tryJump()
    }

    if (this.isSliding && this.time.now >= this.slideUntil) {
      this.endSlide()
    }

    // Lock X; runner stays put while world scrolls.
    this.player.x = LEDGER_RUNNER.playerX
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.x = this.player.x - body.halfWidth

    this.advanceScore(delta)
    this.spawnHazardsIfNeeded()
    this.updateHazards(delta)
    this.cullHazards()
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
  }

  private createRunnerVisual() {
    const c = this.add.container(
      LEDGER_RUNNER.playerX,
      this.groundY - LEDGER_RUNNER.playerH / 2,
    )
    c.setDepth(11)

    const glow = this.add.circle(0, 4, 22, RUNNER_COLORS.bronze, 0.12)
    // Legs
    const legL = this.add.rectangle(-6, 14, 7, 16, RUNNER_COLORS.bronzeDark)
    const legR = this.add.rectangle(6, 14, 7, 16, RUNNER_COLORS.bronzeDark)
    // Torso
    const torso = this.add.rectangle(0, 0, 22, 24, RUNNER_COLORS.bronze)
    // Cape / chevron shoulder
    const cape = this.add.triangle(-14, 2, 0, -10, 0, 12, -14, 6, RUNNER_COLORS.bronzeDark)
    // Head
    const head = this.add.circle(0, -18, 9, RUNNER_COLORS.bronzeBright)
    const visor = this.add.rectangle(3, -18, 10, 4, 0x020617)
    // Arm
    const arm = this.add.rectangle(12, 0, 6, 14, RUNNER_COLORS.bronzeBright)

    c.add([glow, cape, legL, legR, torso, arm, head, visor])
    c.setData('legL', legL)
    c.setData('legR', legR)
    c.setData('torso', torso)
    c.setData('head', head)
    c.setData('arm', arm)
    return c
  }

  private createStarfield(width: number) {
    this.stars = this.add.graphics().setDepth(0)
    this.starOffsets = []
    for (let i = 0; i < 40; i += 1) {
      this.starOffsets.push({
        x: Phaser.Math.Between(0, width),
        y: Phaser.Math.Between(0, this.groundY - 40),
        s: Phaser.Math.FloatBetween(0.5, 2),
        a: Phaser.Math.FloatBetween(0.2, 0.75),
      })
    }
    this.drawStars()
  }

  private drawStars() {
    const { width } = this.scale
    this.stars.clear()
    for (const star of this.starOffsets) {
      this.stars.fillStyle(RUNNER_COLORS.star, star.a)
      this.stars.fillCircle(((star.x % width) + width) % width, star.y, star.s)
    }
  }

  private scrollStarfield(delta: number) {
    const drift =
      (this.state === 'playing' ? this.scrollSpeed : 50) * (delta / 1000) * 0.3
    for (const star of this.starOffsets) {
      star.x -= drift * (0.5 + star.s * 0.25)
    }
    this.drawStars()
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
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
      this.keyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
      this.keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
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

      // Top 70% = jump, bottom 30% = slide
      if (pointer.y > this.scale.height * 0.72) {
        this.startSlide()
      } else {
        this.tryJump()
      }
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
      .setDepth(30)

    this.add
      .text(20, 44, `THRESHOLD  ${LEDGER_RUNNER_REWARD_THRESHOLD}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
        color: '#94a3b8',
        fontStyle: '600',
      })
      .setDepth(30)

    this.hudCombo = this.add
      .text(width - 20, 20, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '18px',
        color: '#d4922a',
        fontStyle: '700',
      })
      .setOrigin(1, 0)
      .setDepth(30)

    this.hudHint = this.add
      .text(
        width / 2,
        height - 28,
        'SPACE / TAP jump  ·  ↓ / bottom tap slide  ·  double-jump in air',
        {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '13px',
          color: '#94a3b8',
        },
      )
      .setOrigin(0.5)
      .setDepth(30)
  }

  private createDeathParticles() {
    this.deathEmitter = this.add.particles(0, 0, 'spark', {
      lifespan: 700,
      speed: { min: 90, max: 280 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [RUNNER_COLORS.bronzeBright, RUNNER_COLORS.bronze, RUNNER_COLORS.quantum],
      emitting: false,
      blendMode: 'ADD',
      quantity: 28,
    })
    this.deathEmitter.setDepth(20)
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
    this.createOverlay()
    const title = this.overlay.getData('title') as Phaser.GameObjects.Text
    const body = this.overlay.getData('body') as Phaser.GameObjects.Text
    const cta = this.overlay.getData('cta') as Phaser.GameObjects.Text

    if (mode === 'ready') {
      title.setText('Ledger Runner')
      body.setText(
        'Auto-run the chain. Jump quantum spikes, slide under bad ledgers, and chain clean clears for combo bonuses.',
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
    this.hudHint.setText(
      mode === 'ready'
        ? 'SPACE / TAP jump  ·  ↓ / bottom tap slide  ·  double-jump in air'
        : 'SPACE or tap to restart',
    )
  }

  private hideOverlay() {
    if (this.overlay) {
      this.overlay.setVisible(false)
    }
  }

  // ── body states ────────────────────────────────────────

  private setStandingBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const w = LEDGER_RUNNER.playerW
    const h = LEDGER_RUNNER.playerH
    this.player.setSize(w, h)
    body.setSize(w, h)
    body.setOffset((32 - w) / 2, (48 - h) / 2)
    // Keep feet on ground when exiting slide
    if (this.onGround || this.player.y > this.groundY - h) {
      this.player.y = this.groundY - h / 2
      body.updateFromGameObject()
    }
  }

  private setSlideBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const w = LEDGER_RUNNER.playerW + 6
    const h = LEDGER_RUNNER.slideH
    this.player.setSize(w, h)
    body.setSize(w, h)
    body.setOffset((32 - w) / 2, 48 - h - 2)
    this.player.y = this.groundY - h / 2
    body.updateFromGameObject()
  }

  // ── run lifecycle ──────────────────────────────────────

  private resetRun() {
    this.state = 'ready'
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

    this.hazards.clear(true, true)
    this.endSlide()
    this.player.setPosition(
      LEDGER_RUNNER.playerX,
      this.groundY - LEDGER_RUNNER.playerH / 2,
    )
    this.player.setVelocity(0, 0)
    this.playerVisual.setAlpha(1)
    this.playerVisual.setAngle(0)
    this.hudScore.setText('SCORE  0')
    this.hudScore.setColor('#f1f5f9')
    this.hudCombo.setText('')
    this.emitScore(0)
  }

  private beginRun() {
    this.state = 'playing'
    this.hideOverlay()
    this.nextSpawnAt = this.time.now + 800
    this.jumpsRemaining = 2
    this.hudHint.setText('Jump spikes · slide bad ledgers · chain combos')
    this.emitState('playing')
  }

  private handleCrash() {
    if (this.state !== 'playing') return

    this.state = 'gameover'
    this.player.setVelocity(0, 0)
    this.combo = 0
    this.hudCombo.setText('')

    this.deathEmitter.setPosition(this.player.x, this.player.y)
    this.deathEmitter.explode(30)
    this.cameras.main.shake(300, 0.014)
    this.cameras.main.flash(140, 192, 120, 56, false)

    this.tweens.add({
      targets: this.playerVisual,
      alpha: 0.3,
      angle: -25,
      y: this.player.y + 8,
      duration: 280,
      ease: 'Quad.easeOut',
    })

    this.showOverlay('gameover')
    this.emitState('gameover')
    this.emitScore(this.score)
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

  private handleSlideInput() {
    const downHeld =
      this.cursors?.down.isDown ||
      this.keyS?.isDown ||
      this.keyDown?.isDown ||
      this.keyZ?.isDown

    if (downHeld && this.onGround && !this.isSliding) {
      this.startSlide()
    }
  }

  private tryJump() {
    if (this.state !== 'playing') return

    if (this.isSliding) {
      this.endSlide()
    }

    if (this.jumpsRemaining <= 0) return

    const isDouble = this.jumpsRemaining === 1 && !this.onGround
    const vy = isDouble
      ? LEDGER_RUNNER.doubleJumpVelocity
      : LEDGER_RUNNER.jumpVelocity

    this.player.setVelocityY(vy)
    this.jumpsRemaining -= 1
    this.onGround = false

    // Small hop juice
    this.tweens.add({
      targets: this.playerVisual,
      scaleY: 0.88,
      scaleX: 1.08,
      duration: 70,
      yoyo: true,
    })
  }

  private startSlide() {
    if (this.state !== 'playing' || !this.onGround || this.isSliding) return

    this.isSliding = true
    this.slideUntil = this.time.now + LEDGER_RUNNER.slideDurationMs
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

  private updateGrounded() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const halfH = body.halfHeight
    const feet = this.player.y + halfH
    const grounded = feet >= this.groundY - 1.5 && body.velocity.y >= 0

    if (grounded) {
      this.player.y = this.groundY - halfH
      body.updateFromGameObject()
      this.player.setVelocityY(0)
      if (!this.onGround) {
        this.onGround = true
        this.jumpsRemaining = 2
      }
      this.onGround = true
    } else {
      this.onGround = false
    }

    // Hard floor clamp
    if (this.player.y + halfH > this.groundY) {
      this.player.y = this.groundY - halfH
      body.updateFromGameObject()
      this.player.setVelocityY(0)
      this.onGround = true
      this.jumpsRemaining = 2
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
    if (!this.playerVisual || !this.player) return

    this.playerVisual.x = this.player.x
    this.playerVisual.y = this.player.y

    const legL = this.playerVisual.getData('legL') as Phaser.GameObjects.Rectangle
    const legR = this.playerVisual.getData('legR') as Phaser.GameObjects.Rectangle
    const torso = this.playerVisual.getData('torso') as Phaser.GameObjects.Rectangle
    const head = this.playerVisual.getData('head') as Phaser.GameObjects.Ellipse
    const arm = this.playerVisual.getData('arm') as Phaser.GameObjects.Rectangle

    if (this.isSliding) {
      this.playerVisual.setScale(1.15, 0.55)
      this.playerVisual.y = this.groundY - LEDGER_RUNNER.slideH / 2
      legL.y = 6
      legR.y = 6
      return
    }

    this.playerVisual.setScale(1, 1)

    if (this.state === 'playing' && this.onGround) {
      this.runBob += delta * (1 + this.difficulty * 0.8)
      const swing = Math.sin(this.runBob / 70) * 6
      legL.y = 14 + swing
      legR.y = 14 - swing
      arm.angle = swing * 1.2
      torso.y = Math.abs(swing) * 0.15
      head.y = -18 + Math.abs(swing) * 0.1
    } else if (!this.onGround) {
      legL.y = 10
      legR.y = 16
      this.playerVisual.angle = Phaser.Math.Clamp(
        (this.player.body?.velocity.y ?? 0) / 40,
        -18,
        22,
      )
    } else {
      this.playerVisual.angle = Phaser.Math.Linear(this.playerVisual.angle, 0, 0.2)
    }
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
    if (this.score !== prev) {
      this.hudScore.setText(`SCORE  ${this.score}`)
      if (
        this.score >= LEDGER_RUNNER_REWARD_THRESHOLD &&
        prev < LEDGER_RUNNER_REWARD_THRESHOLD
      ) {
        this.hudScore.setColor('#d4922a')
        this.cameras.main.flash(80, 208, 146, 42, false)
      }
      this.emitScore(this.score)
    }
  }

  private registerClear(perfect: boolean) {
    this.combo = Math.min(LEDGER_RUNNER.maxCombo, this.combo + 1)
    let bonus = LEDGER_RUNNER.clearBonus
    if (perfect) {
      bonus += LEDGER_RUNNER.perfectBonus
    }
    bonus += Math.max(0, this.combo - 1) * LEDGER_RUNNER.comboStepBonus
    this.addScore(bonus)
    this.showComboFeedback(perfect)
  }

  private showComboFeedback(perfect: boolean) {
    if (this.combo <= 1 && !perfect) {
      this.hudCombo.setText('')
      return
    }

    const label = perfect
      ? `PERFECT  x${this.combo}`
      : this.combo > 1
        ? `COMBO  x${this.combo}`
        : 'CLEAN'
    this.hudCombo.setText(label)
    this.hudCombo.setScale(1.25)
    this.tweens.add({
      targets: this.hudCombo,
      scale: 1,
      duration: 160,
      ease: 'Back.easeOut',
    })

    const pop = this.add
      .text(this.player.x + 40, this.player.y - 40, perfect ? '+PERFECT' : '+CLEAR', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: perfect ? '#22d3ee' : '#d4922a',
        fontStyle: '700',
      })
      .setDepth(25)
    this.tweens.add({
      targets: pop,
      y: pop.y - 36,
      alpha: 0,
      duration: 520,
      onComplete: () => pop.destroy(),
    })
  }

  // ── hazards ────────────────────────────────────────────

  private spawnHazardsIfNeeded() {
    if (this.time.now < this.nextSpawnAt) return

    const interval = Phaser.Math.Linear(
      LEDGER_RUNNER.spawnMaxMs,
      LEDGER_RUNNER.spawnMinMs,
      this.difficulty,
    )

    const roll = Math.random()
    // Weight patterns by difficulty
    if (roll < 0.42) {
      this.spawnSpike()
    } else if (roll < 0.72) {
      this.spawnBarrier()
    } else if (roll < 0.9) {
      this.spawnFloater()
    } else {
      // Double pattern at higher difficulty
      this.spawnSpike()
      if (this.difficulty > 0.35) {
        this.time.delayedCall(280, () => {
          if (this.state === 'playing') this.spawnBarrier()
        })
      }
    }

    this.nextSpawnAt =
      this.time.now + interval * Phaser.Math.FloatBetween(0.88, 1.12)
  }

  private spawnSpike() {
    const x = this.scale.width + 40
    const h = 34
    const w = 38
    const y = this.groundY - h / 2
    const spike = this.hazards.create(x, y, 'spike') as Phaser.Physics.Arcade.Image
    spike.setDisplaySize(w, h)
    spike.refreshBody()
    const body = spike.body as Phaser.Physics.Arcade.Body
    body.setSize(w * 0.7, h * 0.85)
    body.setAllowGravity(false)
    spike.setImmovable(true)
    spike.setDepth(6)

    const meta: HazardMeta = {
      kind: 'spike',
      scored: false,
      dangerTop: this.groundY - h,
      dangerBottom: this.groundY,
    }
    spike.setData('meta', meta)
  }

  private spawnBarrier() {
    // Tall ledger hanging with crawl space under it — must slide
    const x = this.scale.width + 50
    const gap = Phaser.Math.Linear(36, 28, this.difficulty) // slide gap height
    const h = Phaser.Math.Linear(150, 190, this.difficulty)
    const w = 46
    // Barrier hangs from above ground leaving gap at bottom
    const bottom = this.groundY - gap
    const y = bottom - h / 2

    const barrier = this.hazards.create(x, y, 'barrier') as Phaser.Physics.Arcade.Image
    barrier.setDisplaySize(w, h)
    barrier.refreshBody()
    const body = barrier.body as Phaser.Physics.Arcade.Body
    body.setSize(w * 0.85, h * 0.95)
    body.setAllowGravity(false)
    barrier.setImmovable(true)
    barrier.setDepth(6)

    const meta: HazardMeta = {
      kind: 'barrier',
      scored: false,
      dangerTop: y - h / 2,
      dangerBottom: bottom,
    }
    barrier.setData('meta', meta)
  }

  private spawnFloater() {
    const x = this.scale.width + 40
    const size = 34
    // Oscillates at jump height — time the jump
    const baseY = this.groundY - Phaser.Math.Between(70, 120)

    const floater = this.hazards.create(x, baseY, 'floater') as Phaser.Physics.Arcade.Image
    floater.setDisplaySize(size, size)
    floater.refreshBody()
    const body = floater.body as Phaser.Physics.Arcade.Body
    body.setCircle(size * 0.4)
    body.setAllowGravity(false)
    floater.setImmovable(true)
    floater.setDepth(6)
    floater.setData('floatPhase', Math.random() * Math.PI * 2)
    floater.setData('floatBase', baseY)
    floater.setData('floatAmp', Phaser.Math.Between(18, 36))

    const meta: HazardMeta = {
      kind: 'floater',
      scored: false,
      dangerTop: baseY - 40,
      dangerBottom: baseY + 40,
    }
    floater.setData('meta', meta)
  }

  private updateHazards(delta: number) {
    const dx = this.scrollSpeed * (delta / 1000)
    const children = this.hazards.getChildren() as Phaser.Physics.Arcade.Image[]

    for (const haz of children) {
      haz.x -= dx

      // Floater bob
      if (haz.texture.key === 'floater') {
        const phase = (haz.getData('floatPhase') as number) + delta / 280
        haz.setData('floatPhase', phase)
        const base = haz.getData('floatBase') as number
        const amp = haz.getData('floatAmp') as number
        haz.y = base + Math.sin(phase) * amp
      }

      const body = haz.body as Phaser.Physics.Arcade.Body | null
      if (body) {
        body.updateFromGameObject()
      }

      const meta = haz.getData('meta') as HazardMeta | undefined
      if (!meta || meta.scored) continue

      // Cleared when fully past the runner
      if (haz.x + haz.displayWidth / 2 < this.player.x - 12) {
        meta.scored = true

        // Perfect if player wasn't deep in the danger band when clearing
        const feet = this.player.y + (this.player.body as Phaser.Physics.Arcade.Body).halfHeight
        const head = this.player.y - (this.player.body as Phaser.Physics.Arcade.Body).halfHeight
        let perfect = false

        if (meta.kind === 'spike') {
          // Perfect if jumped high enough (feet well above spike tip)
          perfect = feet < meta.dangerTop - 8
        } else if (meta.kind === 'barrier') {
          // Perfect if sliding (low profile) through
          perfect = this.isSliding || head < meta.dangerBottom - 2
        } else {
          // Floater: perfect if not near vertical center
          const mid = (meta.dangerTop + meta.dangerBottom) / 2
          perfect = Math.abs(this.player.y - mid) > 28
        }

        this.registerClear(perfect)
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
