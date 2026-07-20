import Phaser from 'phaser'
import {
  createDataStream,
  createDeathEmitter,
  createHowToOverlay,
  createNebulaBackdrop,
  createParallaxStarfield,
  createPauseButton,
  createPlayerTrail,
  createSparkEmitter,
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
} from '../../utils/gameJuice'
import {
  AA,
  AA_COLORS,
  AMENDMENT_REWARD_THRESHOLD,
  AMENDMENT_SLUG,
  type AmendmentBridge,
  type AmendmentGameState,
  type BugKind,
} from './amendmentApocalypseConfig'

type BulletMeta = {
  homing: boolean
  damage: number
}

type BugMeta = {
  kind: BugKind
  hp: number
  scored: boolean
  angle?: number
  orbitR?: number
  orbitSpeed?: number
}

type PickupKind = 'amendment' | 'hardfork'

/**
 * Amendment Apocalypse — free-roam arena shooter.
 * Defend the ledger; collect Amendments to escalate firepower.
 */
export class AmendmentApocalypseScene extends Phaser.Scene {
  private state: AmendmentGameState = 'ready'
  private paused = false
  private waitingHowTo = false

  private score = 0
  private bestScore = 0
  private weaponTier = 1
  private hitsWithoutAmendment = 0
  private shieldUntil = 0
  private fireBoostUntil = 0
  private nextFireAt = 0
  private nextSpawnAt = 0
  private elapsedPlayMs = 0
  private difficulty = 0
  private combo = 0
  private lastKillAt = 0
  private comboMult = 1
  private survivalAcc = 0
  private streamScroll = 0

  private ship!: Phaser.Physics.Arcade.Image
  private shipVisual!: Phaser.GameObjects.Container
  private shipParts: Phaser.GameObjects.Shape[] = []
  private shieldRing!: Phaser.GameObjects.Arc
  private thrusterGlow!: Phaser.GameObjects.Arc

  private bullets!: Phaser.Physics.Arcade.Group
  private bugs!: Phaser.Physics.Arcade.Group
  private pickups!: Phaser.Physics.Arcade.Group

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyW!: Phaser.Input.Keyboard.Key
  private keyA!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keyP!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key

  private pointerDown = false
  private pointerX = 0
  private pointerY = 0

  private starLayers: StarLayer[] = []
  private nebula!: NebulaBackdrop
  private dataStream!: Phaser.GameObjects.Graphics
  private hudScore!: Phaser.GameObjects.Text
  private hudTier!: Phaser.GameObjects.Text
  private hudCombo!: Phaser.GameObjects.Text
  private hudHint!: Phaser.GameObjects.Text
  private pauseDim!: Phaser.GameObjects.Rectangle
  private pauseLabel!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Container
  private newBestBanner!: Phaser.GameObjects.Text

  private deathEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter

  private joyBase!: Phaser.GameObjects.Arc
  private joyKnob!: Phaser.GameObjects.Arc
  private joyActive = false
  private joyVec = new Phaser.Math.Vector2(0, 0)

  constructor() {
    super('AmendmentApocalypseScene')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(AA_COLORS.bgHex)
    this.physics.world.setBounds(24, 24, width - 48, height - 48)
    this.physics.world.gravity.y = 0
    ensureJuiceTextures(this)

    this.nebula = createNebulaBackdrop(this, width, height, 0)
    this.starLayers = createParallaxStarfield(this, width, height)
    this.dataStream = createDataStream(this, 1)
    this.createTextures()

    this.bullets = this.physics.add.group({ allowGravity: false })
    this.bugs = this.physics.add.group({ allowGravity: false })
    this.pickups = this.physics.add.group({ allowGravity: false })

    this.trail = createPlayerTrail(this, 8)
    this.shipVisual = this.buildShipVisual(width / 2, height / 2)
    // Slightly smaller craft so the arena reads zoomed-out / roomier
    this.shipVisual.setScale(0.88)
    this.ship = this.physics.add.image(width / 2, height / 2, 'ship-hit')
    this.ship.setVisible(false)
    this.ship.setCircle(11)
    this.ship.setCollideWorldBounds(true)
    this.ship.setBounce(0.15)
    this.ship.setDamping(true)
    this.ship.setDrag(0.0005)
    this.ship.setMaxVelocity(AA.maxSpeed)
    this.ship.setDepth(10)
    this.ship.setGravity(0, 0)

    this.physics.add.overlap(
      this.bullets,
      this.bugs,
      (b, e) => this.onBulletHitBug(b as Phaser.Physics.Arcade.Image, e as Phaser.Physics.Arcade.Image),
      undefined,
      this,
    )
    this.physics.add.overlap(
      this.ship,
      this.bugs,
      (_s, e) => this.onShipHitBug(e as Phaser.Physics.Arcade.Image),
      undefined,
      this,
    )
    this.physics.add.overlap(
      this.ship,
      this.pickups,
      (_s, p) => this.onPickup(p as Phaser.Physics.Arcade.Image),
      undefined,
      this,
    )

    this.setupInput()
    this.createHud(width, height)
    this.createJoystick(width, height)
    this.deathEmitter = createDeathEmitter(this)
    this.sparkEmitter = createSparkEmitter(this)

    this.resetRun()

    if (!hasSeenHowTo(AMENDMENT_SLUG)) {
      this.waitingHowTo = true
      createHowToOverlay(
        this,
        'Amendment Apocalypse',
        [
          'WASD / drag to fly. Auto-fire weapons.',
          'ENEMIES: red-marked bugs (drone, missile, spiked ring, ERROR block).',
          'POWERUPS: gold scroll with green + (Amendment) · gold star (Hard Fork).',
          '2 hits without an Amendment → Consensus Broken. Claim at 100.',
        ],
        () => {
          markHowToSeen(AMENDMENT_SLUG)
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
    this.emitTier()
  }

  update(_t: number, delta: number) {
    const scroll =
      this.state === 'playing' && !this.paused ? 80 + this.difficulty * 120 : 30
    updateParallaxStarfield(
      this.starLayers,
      this.scale.width,
      this.scale.height,
      scroll,
      delta,
      'x',
    )
    updateNebulaBackdrop(
      this.nebula,
      this.scale.width,
      this.scale.height,
      delta,
    )
    this.streamScroll += scroll * (delta / 1000) * 0.4
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

    this.syncShipVisual()

    if (this.state === 'ready') {
      this.idleBob(delta)
      if (this.wantsStart()) this.beginRun()
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
      this.elapsedPlayMs / (AA.difficultyRampSeconds * 1000),
      0,
      1,
    )

    this.applyThrust(delta)
    this.autoFire()
    this.spawnBugsIfNeeded()
    this.updateBugs(delta)
    this.updateBullets(delta)
    this.cullOffscreen()
    this.tickSurvivalScore(delta)
    this.updateShieldVisual()
    this.updateJoystickVisual()
  }

  // ── textures / ship ────────────────────────────────────

  private createTextures() {
    if (!this.textures.exists('ship-hit')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 1)
      g.fillCircle(14, 14, 14)
      g.generateTexture('ship-hit', 28, 28)
      g.destroy()
    }
    if (!this.textures.exists('bullet')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(AA_COLORS.bronzeBright, 1)
      g.fillRoundedRect(0, 0, 10, 4, 2)
      g.fillStyle(AA_COLORS.quantumHot, 0.9)
      g.fillCircle(8, 2, 2)
      g.generateTexture('bullet', 10, 4)
      g.destroy()
    }
    if (!this.textures.exists('bullet-home')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(AA_COLORS.quantum, 1)
      g.fillRoundedRect(0, 0, 12, 5, 2)
      g.fillStyle(AA_COLORS.hardFork, 1)
      g.fillCircle(10, 2.5, 2.5)
      g.generateTexture('bullet-home', 12, 5)
      g.destroy()
    }
    // Force-refresh entity art so hostile vs friendly is always clear
    for (const key of [
      'bug-null',
      'bug-race',
      'bug-loop',
      'bug-corrupt',
      'pickup-amend',
      'pickup-fork',
    ]) {
      if (this.textures.exists(key)) this.textures.remove(key)
    }
    this.drawEnemyNull()
    this.drawEnemyRace()
    this.drawEnemyLoop()
    this.drawEnemyCorrupt()
    this.drawPickupAmendment()
    this.drawPickupHardFork()
  }

  /** Slow grey drone — hollow body + red X (hostile null). */
  private drawEnemyNull() {
    const s = 28
    const g = this.make.graphics({ x: 0, y: 0 })
    // Danger halo
    g.lineStyle(2, AA_COLORS.danger, 0.55)
    g.strokeCircle(s / 2, s / 2, s / 2 - 1)
    // Body
    g.fillStyle(0x475569, 1)
    g.fillCircle(s / 2, s / 2, 10)
    g.lineStyle(2, 0x94a3b8, 0.95)
    g.strokeCircle(s / 2, s / 2, 10)
    // Null slash eyes
    g.lineStyle(2.5, AA_COLORS.danger, 1)
    g.lineBetween(8, 10, 12, 14)
    g.lineBetween(12, 10, 8, 14)
    g.lineBetween(16, 10, 20, 14)
    g.lineBetween(20, 10, 16, 14)
    // Mouth bar
    g.lineStyle(2, AA_COLORS.danger, 0.85)
    g.lineBetween(10, 18, 18, 18)
    g.generateTexture('bug-null', s, s)
    g.destroy()
  }

  /** Fast charger — red-tipped arrow missile. */
  private drawEnemyRace() {
    const w = 30
    const h = 20
    const g = this.make.graphics({ x: 0, y: 0 })
    // Body wedge
    g.fillStyle(0xf59e0b, 1)
    g.fillTriangle(0, h / 2, w - 8, 2, w - 8, h - 2)
    // Red danger tip
    g.fillStyle(AA_COLORS.danger, 1)
    g.fillTriangle(w - 10, h / 2, w, 4, w, h - 4)
    // Outline
    g.lineStyle(2, 0x7f1d1d, 0.95)
    g.strokeTriangle(0, h / 2, w, 4, w, h - 4)
    // Speed notches
    g.lineStyle(1.5, 0x450a0a, 0.8)
    g.lineBetween(6, 6, 6, h - 6)
    g.lineBetween(11, 5, 11, h - 5)
    g.generateTexture('bug-race', w, h)
    g.destroy()
  }

  /** Orbiting loop — green ring with red spikes (clearly not a pickup). */
  private drawEnemyLoop() {
    const s = 30
    const c = s / 2
    const g = this.make.graphics({ x: 0, y: 0 })
    // Outer danger ring
    g.lineStyle(3, AA_COLORS.danger, 0.5)
    g.strokeCircle(c, c, 13)
    // Main loop body
    g.lineStyle(4, 0x059669, 1)
    g.strokeCircle(c, c, 10)
    g.lineStyle(2, 0x6ee7b7, 0.95)
    g.strokeCircle(c, c, 10)
    // Inner void
    g.fillStyle(AA_COLORS.bg, 0.85)
    g.fillCircle(c, c, 5)
    // Hostile spikes
    g.fillStyle(AA_COLORS.danger, 1)
    g.fillTriangle(c, 1, c - 3, 7, c + 3, 7)
    g.fillTriangle(c, s - 1, c - 3, s - 7, c + 3, s - 7)
    g.fillTriangle(1, c, 7, c - 3, 7, c + 3)
    g.fillTriangle(s - 1, c, s - 7, c - 3, s - 7, c + 3)
    g.generateTexture('bug-loop', s, s)
    g.destroy()
  }

  /** Tank corrupt block — big magenta brick, ERROR bars, red corners. */
  private drawEnemyCorrupt() {
    const s = 40
    const g = this.make.graphics({ x: 0, y: 0 })
    // Shadow plate
    g.fillStyle(0x831843, 0.9)
    g.fillRoundedRect(2, 2, s - 2, s - 2, 4)
    // Main block
    g.fillStyle(0xdb2777, 1)
    g.fillRoundedRect(0, 0, s - 4, s - 4, 4)
    g.lineStyle(2.5, AA_COLORS.danger, 1)
    g.strokeRoundedRect(0, 0, s - 4, s - 4, 4)
    // Code lines
    g.lineStyle(2, 0xfbcfe8, 0.85)
    g.lineBetween(6, 10, 30, 10)
    g.lineBetween(6, 17, 26, 17)
    g.lineBetween(6, 24, 28, 24)
    // ERROR tag
    g.fillStyle(AA_COLORS.danger, 1)
    g.fillRect(6, 28, 22, 6)
    // Corner ticks (hostile)
    g.fillStyle(0xfef2f2, 1)
    g.fillRect(0, 0, 6, 3)
    g.fillRect(0, 0, 3, 6)
    g.fillRect(s - 10, 0, 6, 3)
    g.fillRect(s - 7, 0, 3, 6)
    g.generateTexture('bug-corrupt', s, s)
    g.destroy()
  }

  /** Friendly Amendment scroll + big green plus (cannot confuse with bugs). */
  private drawPickupAmendment() {
    const s = 36
    const g = this.make.graphics({ x: 0, y: 0 })
    // Soft gold halo (friendly)
    g.fillStyle(AA_COLORS.bronzeBright, 0.22)
    g.fillCircle(s / 2, s / 2, 17)
    g.lineStyle(2, AA_COLORS.hardFork, 0.7)
    g.strokeCircle(s / 2, s / 2, 16)
    // Scroll body
    g.fillStyle(0xfef3c7, 1)
    g.fillRoundedRect(10, 6, 16, 22, 2)
    g.lineStyle(2, AA_COLORS.bronze, 1)
    g.strokeRoundedRect(10, 6, 16, 22, 2)
    // Text lines
    g.lineStyle(1.5, AA_COLORS.bronzeDark, 0.75)
    g.lineBetween(13, 12, 23, 12)
    g.lineBetween(13, 16, 23, 16)
    g.lineBetween(13, 20, 20, 20)
    // Big green PLUS badge
    g.fillStyle(0x22c55e, 1)
    g.fillCircle(26, 26, 8)
    g.lineStyle(2, 0xbbf7d0, 1)
    g.strokeCircle(26, 26, 8)
    g.lineStyle(3, 0xffffff, 1)
    g.lineBetween(26, 21, 26, 31)
    g.lineBetween(21, 26, 31, 26)
    g.generateTexture('pickup-amend', s, s)
    g.destroy()
  }

  /** Friendly Hard Fork — gold star burst (distinct from every enemy). */
  private drawPickupHardFork() {
    const s = 36
    const c = s / 2
    const g = this.make.graphics({ x: 0, y: 0 })
    // Cyan-gold friendly halo
    g.fillStyle(AA_COLORS.quantum, 0.2)
    g.fillCircle(c, c, 17)
    g.lineStyle(2, AA_COLORS.hardFork, 0.85)
    g.strokeCircle(c, c, 16)
    // 4-point star
    g.fillStyle(AA_COLORS.hardFork, 1)
    g.fillTriangle(c, 4, c - 5, c, c + 5, c)
    g.fillTriangle(c, s - 4, c - 5, c, c + 5, c)
    g.fillTriangle(4, c, c, c - 5, c, c + 5)
    g.fillTriangle(s - 4, c, c, c - 5, c, c + 5)
    // Center core
    g.fillStyle(0xffffff, 1)
    g.fillCircle(c, c, 5)
    g.fillStyle(AA_COLORS.quantumHot, 1)
    g.fillCircle(c, c, 3)
    g.generateTexture('pickup-fork', s, s)
    g.destroy()
  }

  private buildShipVisual(x: number, y: number) {
    const c = this.add.container(x, y).setDepth(11)
    this.rebuildShipParts(c, 1)
    this.shieldRing = this.add.circle(0, 0, 28, AA_COLORS.shield, 0.0)
    this.shieldRing.setStrokeStyle(2, AA_COLORS.shield, 0)
    c.add(this.shieldRing)
    this.thrusterGlow = this.add.circle(-14, 0, 8, AA_COLORS.quantum, 0.35)
    c.addAt(this.thrusterGlow, 0)
    return c
  }

  private rebuildShipParts(c: Phaser.GameObjects.Container, tier: number) {
    // Keep shield + thruster if present
    const keep = new Set([this.shieldRing, this.thrusterGlow])
    for (const child of [...c.list]) {
      if (!keep.has(child as Phaser.GameObjects.Arc)) {
        c.remove(child, true)
      }
    }
    this.shipParts = []

    const bronze = AA_COLORS.bronze
    const bright = AA_COLORS.bronzeBright
    const dark = AA_COLORS.bronzeDark

    // Core hull (always)
    const hull = this.add.triangle(0, 0, 16, 0, -12, -10, -12, 10, bronze)
    const core = this.add.triangle(2, 0, 10, 0, -6, -5, -6, 5, bright)
    const nose = this.add.circle(12, 0, 3, bright)
    this.shipParts.push(hull, core, nose)
    c.add([hull, core, nose])

    if (tier >= 2) {
      const finT = this.add.triangle(-4, -12, 6, 4, -6, 4, 0, -10, dark)
      const finB = this.add.triangle(-4, 12, 6, -4, -6, -4, 0, 10, dark)
      this.shipParts.push(finT, finB)
      c.add([finT, finB])
    }
    if (tier >= 3) {
      const wingT = this.add.triangle(-2, -8, 8, 2, -10, 4, -4, -16, bright)
      const wingB = this.add.triangle(-2, 8, 8, -2, -10, -4, -4, 16, dark)
      this.shipParts.push(wingT, wingB)
      c.add([wingT, wingB])
    }
    if (tier >= 4) {
      const plate = this.add.rectangle(0, 0, 8, 14, dark, 0.7)
      const line = this.add.rectangle(4, 0, 12, 2, AA_COLORS.hardFork, 0.9)
      this.shipParts.push(plate, line)
      c.add([plate, line])
    }
    if (tier >= 5) {
      const rearL = this.add.triangle(-14, -6, 0, -4, 0, 4, -10, 0, bright)
      const rearR = this.add.triangle(-14, 6, 0, -4, 0, 4, -10, 0, dark)
      const glow = this.add.circle(0, 0, 18, bright, 0.1)
      this.shipParts.push(rearL, rearR, glow)
      c.addAt(glow, 0)
      c.add([rearL, rearR])
    }
    if (tier >= 6) {
      const crown = this.add.triangle(6, 0, 8, 0, -2, -7, -2, 7, AA_COLORS.hardFork)
      const halo = this.add.circle(0, 0, 22, AA_COLORS.quantum, 0.08)
      halo.setStrokeStyle(1.5, AA_COLORS.quantum, 0.5)
      const node = this.add.circle(8, 0, 2.5, AA_COLORS.quantumHot)
      this.shipParts.push(crown, halo, node)
      c.addAt(halo, 0)
      c.add([crown, node])
    }

    // Re-add thruster/shield on top layers
    if (this.thrusterGlow) c.addAt(this.thrusterGlow, 0)
    if (this.shieldRing) c.add(this.shieldRing)
  }

  // ── input ──────────────────────────────────────────────

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      this.keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
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
      this.pointerDown = true
      this.pointerX = p.x
      this.pointerY = p.y
      // Virtual stick if lower-left region
      if (p.x < this.scale.width * 0.4 && p.y > this.scale.height * 0.45) {
        this.joyActive = true
        this.joyBase.setPosition(p.x, p.y).setVisible(true)
        this.joyKnob.setPosition(p.x, p.y).setVisible(true)
      }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.state !== 'playing' || this.paused) return
      this.pointerX = p.x
      this.pointerY = p.y
      if (this.joyActive) {
        const dx = p.x - this.joyBase.x
        const dy = p.y - this.joyBase.y
        const len = Math.hypot(dx, dy) || 1
        const max = 48
        const clamped = Math.min(len, max)
        this.joyVec.set((dx / len) * (clamped / max), (dy / len) * (clamped / max))
        this.joyKnob.setPosition(
          this.joyBase.x + (dx / len) * clamped,
          this.joyBase.y + (dy / len) * clamped,
        )
      }
    })
    this.input.on('pointerup', () => {
      this.pointerDown = false
      this.joyActive = false
      this.joyVec.set(0, 0)
      this.joyBase.setVisible(false)
      this.joyKnob.setVisible(false)
    })
  }

  private createJoystick(width: number, height: number) {
    this.joyBase = this.add
      .circle(80, height - 80, 52, AA_COLORS.panel, 0.35)
      .setStrokeStyle(2, AA_COLORS.bronze, 0.4)
      .setDepth(40)
      .setVisible(false)
      .setScrollFactor(0)
    this.joyKnob = this.add
      .circle(80, height - 80, 22, AA_COLORS.bronze, 0.55)
      .setDepth(41)
      .setVisible(false)
      .setScrollFactor(0)
    void width
  }

  private updateJoystickVisual() {
    // static until active
  }

  // ── HUD ────────────────────────────────────────────────

  private createHud(width: number, height: number) {
    this.add
      .rectangle(12, 12, 200, 72, 0x0f172a, 0.88)
      .setOrigin(0, 0)
      .setStrokeStyle(1, AA_COLORS.bronze, 0.4)
      .setDepth(40)

    this.hudScore = this.add
      .text(22, 18, 'SCORE  0', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '18px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setDepth(41)

    this.hudTier = this.add
      .text(22, 42, 'AMENDMENT TIER  1/6', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
        color: '#d4922a',
        fontStyle: '600',
      })
      .setDepth(41)

    this.hudCombo = this.add
      .text(width - 56, 22, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#22d3ee',
        fontStyle: '700',
      })
      .setOrigin(1, 0)
      .setDepth(41)

    this.hudHint = this.add
      .text(
        width / 2,
        height - 22,
        'Shoot red bugs  ·  grab green+ scroll / gold ★  ·  WASD  ·  P pause',
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
      .text(width / 2, height / 2, 'PAUSED\nP to resume', {
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
      .text(width / 2, 80, 'NEW BEST!', {
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
    this.pauseDim.setVisible(this.paused)
    this.pauseLabel.setVisible(this.paused)
    if (this.paused) {
      stopTrail(this.trail)
      this.physics.pause()
    } else {
      this.physics.resume()
      startTrail(this.trail, this.ship)
    }
  }

  private createOverlay() {
    if (this.overlay) this.overlay.destroy(true)
    const { width, height } = this.scale
    const container = this.add.container(width / 2, height / 2).setDepth(50)
    const panel = this.add
      .rectangle(0, 0, 460, 230, AA_COLORS.panel, 0.95)
      .setStrokeStyle(2, AA_COLORS.bronze, 0.8)
    const title = this.add
      .text(0, -70, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '26px',
        color: '#f1f5f9',
        fontStyle: '700',
      })
      .setOrigin(0.5)
    const body = this.add
      .text(0, -4, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#94a3b8',
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5)
    const cta = this.add
      .text(0, 78, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '15px',
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
      title.setText('Amendment Apocalypse')
      body.setText(
        'Defend the ledger from rogue code. Collect Amendments to escalate your weapon. Two hits without recovery breaks consensus.',
      )
      cta.setText('TAP / SPACE TO DEPLOY')
    } else {
      title.setText('Consensus Broken')
      body.setText(
        `Final score  ${this.score}\nClear ${AMENDMENT_REWARD_THRESHOLD} to unlock Claim.`,
      )
      cta.setText('TAP / SPACE TO RESTART')
    }
    this.overlay.setVisible(true)
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
    this.weaponTier = 1
    this.hitsWithoutAmendment = 0
    this.shieldUntil = 0
    this.fireBoostUntil = 0
    this.nextFireAt = 0
    this.nextSpawnAt = 0
    this.elapsedPlayMs = 0
    this.difficulty = 0
    this.combo = 0
    this.comboMult = 1
    this.survivalAcc = 0
    stopTrail(this.trail)

    this.bullets.clear(true, true)
    this.bugs.clear(true, true)
    this.pickups.clear(true, true)

    this.ship.setPosition(this.scale.width / 2, this.scale.height / 2)
    this.ship.setVelocity(0, 0)
    this.shipVisual.setPosition(this.ship.x, this.ship.y)
    this.shipVisual.setAlpha(1)
    this.shipVisual.setAngle(0)
    this.rebuildShipParts(this.shipVisual, 1)
    this.hudScore.setText('SCORE  0')
    this.hudScore.setColor('#f1f5f9')
    this.hudTier.setText('AMENDMENT TIER  1/6')
    this.hudCombo.setText('')
    this.emitScore(0)
    this.emitTier()
  }

  private beginRun() {
    if (this.waitingHowTo) return
    this.state = 'playing'
    this.hideOverlay()
    this.nextSpawnAt = this.time.now + 600
    this.hudHint.setText('Collect Amendments · dodge bugs · hold high tiers')
    startTrail(this.trail, this.ship)
    this.emitState('playing')
  }

  private handleDeath() {
    if (this.state !== 'playing') return
    this.state = 'gameover'
    this.ship.setVelocity(0, 0)
    stopTrail(this.trail)
    playDeathJuice(this, this.ship.x, this.ship.y, this.difficulty, this.deathEmitter)
    this.tweens.add({
      targets: this.shipVisual,
      alpha: 0.25,
      angle: this.shipVisual.angle + 40,
      duration: 300,
    })
    this.time.delayedCall(360, () => {
      this.showOverlay('gameover')
      this.emitState('gameover')
      this.emitScore(this.score)
    })
  }

  private wantsStart() {
    return Boolean(this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace))
  }

  // ── movement ───────────────────────────────────────────

  private thrustVector(): Phaser.Math.Vector2 {
    const v = new Phaser.Math.Vector2(0, 0)
    if (this.cursors?.left.isDown || this.keyA?.isDown) v.x -= 1
    if (this.cursors?.right.isDown || this.keyD?.isDown) v.x += 1
    if (this.cursors?.up.isDown || this.keyW?.isDown) v.y -= 1
    if (this.cursors?.down.isDown || this.keyS?.isDown) v.y += 1

    if (this.joyActive && this.joyVec.lengthSq() > 0.01) {
      v.add(this.joyVec)
    } else if (this.pointerDown && !this.joyActive) {
      // drag-toward-pointer
      const dx = this.pointerX - this.ship.x
      const dy = this.pointerY - this.ship.y
      const len = Math.hypot(dx, dy) || 1
      if (len > 12) v.set(dx / len, dy / len)
    }

    if (v.lengthSq() > 1) v.normalize()
    return v
  }

  private applyThrust(delta: number) {
    const dir = this.thrustVector()
    const body = this.ship.body as Phaser.Physics.Arcade.Body
    if (dir.lengthSq() > 0.01) {
      const ax = dir.x * AA.accel * (delta / 1000)
      const ay = dir.y * AA.accel * (delta / 1000)
      body.velocity.x += ax
      body.velocity.y += ay
      // Face travel direction
      const angle = Phaser.Math.RadToDeg(Math.atan2(dir.y, dir.x))
      this.shipVisual.setAngle(angle)
      this.thrusterGlow.setAlpha(0.45 + Math.random() * 0.3)
      this.thrusterGlow.setScale(0.9 + Math.random() * 0.4)
    } else {
      // Face velocity if moving
      const spd = body.velocity.length()
      if (spd > 20) {
        this.shipVisual.setAngle(
          Phaser.Math.RadToDeg(Math.atan2(body.velocity.y, body.velocity.x)),
        )
      }
      this.thrusterGlow.setAlpha(0.15)
      // light drag
      body.velocity.scale(AA.drag)
    }
    // Clamp max speed
    if (body.velocity.length() > AA.maxSpeed) {
      body.velocity.setLength(AA.maxSpeed)
    }
  }

  private idleBob(delta: number) {
    const t = this.time.now / 400
    this.ship.y = this.scale.height / 2 + Math.sin(t) * 8
    this.ship.x = this.scale.width / 2 + Math.cos(t * 0.7) * 6
    this.syncShipVisual()
    this.shipVisual.angle = Math.sin(t) * 8
    void delta
  }

  private syncShipVisual() {
    this.shipVisual.x = this.ship.x
    this.shipVisual.y = this.ship.y
  }

  private updateShieldVisual() {
    const active = this.time.now < this.shieldUntil
    this.shieldRing.setStrokeStyle(
      2.5,
      AA_COLORS.shield,
      active ? 0.85 : 0,
    )
    this.shieldRing.setFillStyle(AA_COLORS.shield, active ? 0.12 : 0)
    if (active) {
      this.shieldRing.setScale(1 + Math.sin(this.time.now / 80) * 0.08)
    }
  }

  // ── weapons ────────────────────────────────────────────

  private fireInterval(): number {
    const tier = this.weaponTier
    let ms = Phaser.Math.Linear(AA.baseFireMs, AA.minFireMs + 40, (tier - 1) / 5)
    if (this.time.now < this.fireBoostUntil) ms *= AA.hardForkFireMult
    return ms
  }

  private autoFire() {
    if (this.time.now < this.nextFireAt) return
    this.nextFireAt = this.time.now + this.fireInterval()
    this.fireWeapon()
  }

  private fireWeapon() {
    const angle = Phaser.Math.DegToRad(this.shipVisual.angle)
    const tier = this.weaponTier
    const origin = new Phaser.Math.Vector2(this.ship.x, this.ship.y)

    const spawn = (
      ang: number,
      ox: number,
      oy: number,
      homing = false,
    ) => {
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      // offset perpendicular / along
      const px = origin.x + cos * ox - sin * oy
      const py = origin.y + sin * ox + cos * oy
      const key = homing ? 'bullet-home' : 'bullet'
      const b = this.bullets.create(px, py, key) as Phaser.Physics.Arcade.Image
      b.setDepth(9)
      b.setAngle(Phaser.Math.RadToDeg(ang))
      const body = b.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setVelocity(cos * AA.bulletSpeed, sin * AA.bulletSpeed)
      b.setData('meta', { homing, damage: 1 } satisfies BulletMeta)
      b.setData('born', this.time.now)
    }

    const spread = 0.18
    switch (tier) {
      case 1:
        spawn(angle, 14, 0)
        break
      case 2:
        spawn(angle, 14, 0)
        break
      case 3:
        spawn(angle, 14, -5)
        spawn(angle, 14, 5)
        break
      case 4:
        spawn(angle, 14, 0)
        spawn(angle - spread, 12, -4)
        spawn(angle + spread, 12, 4)
        break
      case 5:
        spawn(angle, 14, -5)
        spawn(angle, 14, 5)
        spawn(angle + Math.PI, 12, -5)
        spawn(angle + Math.PI, 12, 5)
        break
      default:
        // tier 6: back 2 + front 3 splayed, center front mild homing
        spawn(angle + Math.PI, 12, -5)
        spawn(angle + Math.PI, 12, 5)
        spawn(angle - spread, 12, -4)
        spawn(angle + spread, 12, 4)
        spawn(angle, 14, 0, true)
        break
    }
  }

  private updateBullets(delta: number) {
    const list = this.bullets.getChildren() as Phaser.Physics.Arcade.Image[]
    for (const b of list) {
      const born = (b.getData('born') as number) ?? 0
      if (this.time.now - born > AA.bulletLifeMs) {
        b.destroy()
        continue
      }
      const meta = b.getData('meta') as BulletMeta | undefined
      if (meta?.homing) {
        const target = this.nearestBug(b.x, b.y, 220)
        if (target) {
          const desired = Math.atan2(target.y - b.y, target.x - b.x)
          const cur = Phaser.Math.DegToRad(b.angle)
          let diff = Phaser.Math.Angle.Wrap(desired - cur)
          const maxTurn = 2.2 * (delta / 1000)
          diff = Phaser.Math.Clamp(diff, -maxTurn, maxTurn)
          const next = cur + diff
          b.setAngle(Phaser.Math.RadToDeg(next))
          const body = b.body as Phaser.Physics.Arcade.Body
          body.setVelocity(
            Math.cos(next) * AA.bulletSpeed,
            Math.sin(next) * AA.bulletSpeed,
          )
        }
      }
    }
  }

  private nearestBug(x: number, y: number, maxDist: number) {
    let best: Phaser.Physics.Arcade.Image | null = null
    let bestD = maxDist
    for (const e of this.bugs.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!e.active) continue
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best
  }

  // ── bugs ───────────────────────────────────────────────

  private spawnBugsIfNeeded() {
    if (this.time.now < this.nextSpawnAt) return

    // Tier heat: full Amendments (6) almost doubles pressure vs tier 1
    const tierHeat = (this.weaponTier - 1) / Math.max(1, AA.maxWeaponTier - 1)
    const heat = Phaser.Math.Clamp(
      this.difficulty * 0.65 + tierHeat * AA.highTierSpawnMult,
      0,
      1,
    )
    const interval = Phaser.Math.Linear(AA.spawnMaxMs, AA.spawnMinMs, heat)

    this.spawnBug(this.pickBugKind(heat))
    // Double / triple packs scale with heat (brutal at full power)
    if (heat > 0.25 && Math.random() < 0.25 + heat * 0.35) {
      this.time.delayedCall(140, () => {
        if (this.state === 'playing') this.spawnBug(this.pickBugKind(heat))
      })
    }
    if (heat > 0.55 && Math.random() < 0.2 + tierHeat * 0.35) {
      this.time.delayedCall(280, () => {
        if (this.state === 'playing') this.spawnBug(this.pickBugKind(heat))
      })
    }
    // At max tier, occasional race rush
    if (this.weaponTier >= 5 && Math.random() < 0.18 + tierHeat * 0.15) {
      this.time.delayedCall(80, () => {
        if (this.state === 'playing') this.spawnBug('race')
      })
    }

    this.nextSpawnAt =
      this.time.now + interval * Phaser.Math.FloatBetween(0.8, 1.1)
  }

  private pickBugKind(heat = this.difficulty): BugKind {
    // Higher heat → fewer nulls, more race/loop/corrupt
    const r = Math.random()
    if (heat < 0.35) {
      if (r < 0.4) return 'null'
      if (r < 0.65) return 'race'
      if (r < 0.85) return 'loop'
      return 'corrupt'
    }
    if (heat < 0.7) {
      if (r < 0.22) return 'null'
      if (r < 0.5) return 'race'
      if (r < 0.78) return 'loop'
      return 'corrupt'
    }
    // Full power / late game
    if (r < 0.12) return 'null'
    if (r < 0.42) return 'race'
    if (r < 0.72) return 'loop'
    return 'corrupt'
  }

  private spawnBug(kind: BugKind) {
    const { width, height } = this.scale
    const edge = Phaser.Math.Between(0, 3)
    let x = 0
    let y = 0
    if (edge === 0) {
      x = -20
      y = Phaser.Math.Between(40, height - 40)
    } else if (edge === 1) {
      x = width + 20
      y = Phaser.Math.Between(40, height - 40)
    } else if (edge === 2) {
      x = Phaser.Math.Between(40, width - 40)
      y = -20
    } else {
      x = Phaser.Math.Between(40, width - 40)
      y = height + 20
    }

    const tex =
      kind === 'null'
        ? 'bug-null'
        : kind === 'race'
          ? 'bug-race'
          : kind === 'loop'
            ? 'bug-loop'
            : 'bug-corrupt'

    const bug = this.bugs.create(x, y, tex) as Phaser.Physics.Arcade.Image
    bug.setDepth(7)
    // Hostile tint pulse — never looks “friendly gold”
    bug.setTint(0xffffff)
    const body = bug.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    // Corrupt is larger on field
    if (kind === 'corrupt') bug.setScale(1.05)
    else if (kind === 'race') bug.setScale(1.1)

    const meta: BugMeta = {
      kind,
      hp: kind === 'corrupt' ? 4 + Math.floor(this.difficulty * 3) : 1,
      scored: false,
    }

    const tierHeat = (this.weaponTier - 1) / Math.max(1, AA.maxWeaponTier - 1)
    const speedBoost = 1 + this.difficulty * 0.45 + tierHeat * 0.55

    if (kind === 'null') {
      const ang = Math.atan2(this.ship.y - y, this.ship.x - x)
      const spd = (60 + this.difficulty * 50) * speedBoost
      body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd)
    } else if (kind === 'race') {
      const ang = Math.atan2(this.ship.y - y, this.ship.x - x)
      const spd = (200 + this.difficulty * 140) * speedBoost
      body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd)
      bug.setAngle(Phaser.Math.RadToDeg(ang))
    } else if (kind === 'loop') {
      meta.orbitR = Phaser.Math.Between(60, 110)
      meta.orbitSpeed =
        (1.4 + this.difficulty * 1.1 + tierHeat * 0.8) *
        (Math.random() < 0.5 ? 1 : -1)
      meta.angle = Math.random() * Math.PI * 2
      body.setVelocity(0, 0)
    } else {
      const ang = Math.atan2(this.ship.y - y, this.ship.x - x)
      const spd = (48 + this.difficulty * 40) * speedBoost
      body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd)
      meta.hp = 4 + Math.floor(this.difficulty * 3) + Math.floor(tierHeat * 3)
    }

    bug.setData('meta', meta)
  }

  private updateBugs(delta: number) {
    for (const bug of this.bugs.getChildren() as Phaser.Physics.Arcade.Image[]) {
      const meta = bug.getData('meta') as BugMeta | undefined
      if (!meta) continue
      if (meta.kind === 'loop') {
        meta.angle = (meta.angle ?? 0) + (meta.orbitSpeed ?? 1) * (delta / 1000)
        const r = meta.orbitR ?? 90
        bug.x = this.ship.x + Math.cos(meta.angle) * r
        bug.y = this.ship.y + Math.sin(meta.angle) * r
        const body = bug.body as Phaser.Physics.Arcade.Body
        body.updateFromGameObject()
      } else if (meta.kind === 'null') {
        // gentle drift toward player
        const ang = Math.atan2(this.ship.y - bug.y, this.ship.x - bug.x)
        const body = bug.body as Phaser.Physics.Arcade.Body
        const tierHeat =
          (this.weaponTier - 1) / Math.max(1, AA.maxWeaponTier - 1)
        const spd = (55 + this.difficulty * 45) * (1 + tierHeat * 0.4)
        body.velocity.x = Phaser.Math.Linear(
          body.velocity.x,
          Math.cos(ang) * spd,
          0.03 + tierHeat * 0.02,
        )
        body.velocity.y = Phaser.Math.Linear(
          body.velocity.y,
          Math.sin(ang) * spd,
          0.03 + tierHeat * 0.02,
        )
      }
    }
  }

  private cullOffscreen() {
    const pad = 80
    const { width, height } = this.scale
    for (const b of this.bullets.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (b.x < -pad || b.x > width + pad || b.y < -pad || b.y > height + pad) {
        b.destroy()
      }
    }
    for (const e of this.bugs.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (e.x < -pad * 2 || e.x > width + pad * 2 || e.y < -pad * 2 || e.y > height + pad * 2) {
        // recycle race bugs that missed
        if ((e.getData('meta') as BugMeta)?.kind === 'race') e.destroy()
      }
    }
  }

  // ── combat resolve ─────────────────────────────────────

  private onBulletHitBug(
    bullet: Phaser.Physics.Arcade.Image,
    bug: Phaser.Physics.Arcade.Image,
  ) {
    if (!bullet.active || !bug.active) return
    const meta = bug.getData('meta') as BugMeta | undefined
    if (!meta || meta.scored) return
    const bmeta = bullet.getData('meta') as BulletMeta | undefined
    meta.hp -= bmeta?.damage ?? 1
    bullet.destroy()
    this.sparkEmitter.setPosition(bug.x, bug.y)
    this.sparkEmitter.explode(6)

    if (meta.hp <= 0) {
      meta.scored = true
      this.registerKill(bug, meta)
      bug.destroy()
    } else {
      this.tweens.add({
        targets: bug,
        alpha: 0.4,
        duration: 50,
        yoyo: true,
      })
    }
  }

  private registerKill(bug: Phaser.Physics.Arcade.Image, meta: BugMeta) {
    // Combo
    if (this.time.now - this.lastKillAt < AA.comboWindowMs) {
      this.combo += 1
    } else {
      this.combo = 1
    }
    this.lastKillAt = this.time.now
    this.comboMult = Math.min(
      AA.maxComboMult,
      1 + (this.combo - 1) * AA.comboStep * (1 + this.weaponTier * 0.08),
    )
    this.hudCombo.setText(this.combo > 1 ? `COMBO x${this.combo}` : '')

    let pts: number = AA.killBase
    if (meta.kind === 'race') pts = 12
    if (meta.kind === 'loop') pts = 14
    if (meta.kind === 'corrupt') pts = 22
    pts = Math.round(pts * this.comboMult * (1 + this.weaponTier * 0.06))
    this.addScore(pts)
    floatScoreText(
      this,
      bug.x,
      bug.y - 12,
      this.combo > 1 ? `+${pts} x${this.combo}` : `+${pts}`,
      meta.kind === 'corrupt' ? '#f472b6' : '#d4922a',
    )

    // Drops — rarer overall, much rarer when already powered up
    this.maybeDropPickup(bug.x, bug.y, meta.kind)
  }

  private maybeDropPickup(x: number, y: number, kind: BugKind) {
    const onField = this.pickups.countActive(true)
    if (onField >= AA.maxPickupsOnField) return

    // At tier 6, suppress almost everything; at low tier, allow a few
    const tierHeat = (this.weaponTier - 1) / Math.max(1, AA.maxWeaponTier - 1)
    const scarcity = 1 - tierHeat * 0.85 // tier 6 → ~0.15 of base rates

    let amendChance =
      (kind === 'corrupt' ? AA.amendDropCorrupt : AA.amendDropBase) * scarcity
    // No Amendments needed if already maxed — only rare hard forks for clear
    if (this.weaponTier >= AA.maxWeaponTier) {
      amendChance *= 0.08
    } else if (this.weaponTier >= 5) {
      amendChance *= 0.35
    } else if (this.weaponTier >= 4) {
      amendChance *= 0.55
    }

    if (Math.random() < amendChance) {
      this.spawnPickup(x, y, 'amendment')
      return
    }

    let forkChance = AA.hardForkDropBase * scarcity
    if (this.weaponTier >= 5) forkChance *= 0.5
    if (Math.random() < forkChance) {
      this.spawnPickup(x, y, 'hardfork')
    }
  }

  private onShipHitBug(bug: Phaser.Physics.Arcade.Image) {
    if (this.state !== 'playing') return
    if (this.time.now < this.shieldUntil) return

    // brief i-frames via short shield to avoid multi-frame hits
    this.shieldUntil = this.time.now + 350
    this.hitsWithoutAmendment += 1
    this.weaponTier = Math.max(1, this.weaponTier - 1)
    this.rebuildShipParts(this.shipVisual, this.weaponTier)
    this.hudTier.setText(`AMENDMENT TIER  ${this.weaponTier}/6`)
    this.emitTier()

    this.cameras.main.shake(140, 0.01)
    this.sparkEmitter.setPosition(this.ship.x, this.ship.y)
    this.sparkEmitter.explode(14)
    floatScoreText(this, this.ship.x, this.ship.y - 28, 'TIER -1', '#f87171')

    // destroy the bug on contact (except corrupt soft bounce)
    const meta = bug.getData('meta') as BugMeta | undefined
    if (meta && meta.kind !== 'corrupt') {
      bug.destroy()
    } else if (meta) {
      const ang = Math.atan2(bug.y - this.ship.y, bug.x - this.ship.x)
      const body = bug.body as Phaser.Physics.Arcade.Body
      body.setVelocity(Math.cos(ang) * 160, Math.sin(ang) * 160)
    }

    if (this.hitsWithoutAmendment >= 2) {
      floatScoreText(this, this.ship.x, this.ship.y - 48, 'CONSENSUS BROKEN', '#f87171', {
        fontSize: '16px',
      })
      this.handleDeath()
    }
  }

  private spawnPickup(x: number, y: number, kind: PickupKind) {
    const key = kind === 'amendment' ? 'pickup-amend' : 'pickup-fork'
    const p = this.pickups.create(x, y, key) as Phaser.Physics.Arcade.Image
    p.setDepth(12)
    p.setData('kind', kind)
    const body = p.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setVelocity(Phaser.Math.Between(-16, 16), Phaser.Math.Between(-16, 16))
    // Larger friendly hit-target + bounce pulse
    p.setScale(1.15)
    this.tweens.add({
      targets: p,
      scale: { from: 1.05, to: 1.28 },
      duration: 420,
      yoyo: true,
      repeat: -1,
    })
    // Brief label so first-time players read “this is good”
    const label =
      kind === 'amendment' ? '+ AMENDMENT' : '★ HARD FORK'
    const color = kind === 'amendment' ? '#4ade80' : '#f0c14a'
    floatScoreText(this, x, y - 22, label, color, { fontSize: '13px', rise: 28 })
  }

  private onPickup(p: Phaser.Physics.Arcade.Image) {
    if (!p.active || this.state !== 'playing') return
    const kind = p.getData('kind') as PickupKind
    p.destroy()

    if (kind === 'amendment') {
      this.collectAmendment()
    } else {
      this.collectHardFork()
    }
  }

  private collectAmendment() {
    const prev = this.weaponTier
    this.weaponTier = Math.min(AA.maxWeaponTier, this.weaponTier + 1)
    this.hitsWithoutAmendment = 0
    this.shieldUntil = this.time.now + AA.shieldMs
    this.rebuildShipParts(this.shipVisual, this.weaponTier)
    this.hudTier.setText(`AMENDMENT TIER  ${this.weaponTier}/6`)
    this.emitTier()

    flashCleanPass(this)
    this.sparkEmitter.setPosition(this.ship.x, this.ship.y)
    this.sparkEmitter.explode(18)
    floatScoreText(
      this,
      this.ship.x,
      this.ship.y - 30,
      this.weaponTier > prev ? `TIER ${this.weaponTier}  SHIELD` : 'SHIELD',
      '#a78bfa',
      { fontSize: '15px' },
    )
    this.addScore(10)
  }

  private collectHardFork() {
    this.fireBoostUntil = this.time.now + AA.hardForkFireBoostMs
    // screen clear
    for (const bug of [...this.bugs.getChildren()] as Phaser.Physics.Arcade.Image[]) {
      const meta = bug.getData('meta') as BugMeta | undefined
      if (meta && !meta.scored) {
        meta.scored = true
        this.registerKill(bug, meta)
      }
      bug.destroy()
    }
    this.cameras.main.flash(200, 240, 193, 74, false)
    this.cameras.main.shake(200, 0.012)
    floatScoreText(this, this.ship.x, this.ship.y - 36, 'HARD FORK', '#f0c14a', {
      fontSize: '18px',
    })
    this.addScore(40)
  }

  // ── score ──────────────────────────────────────────────

  private tickSurvivalScore(delta: number) {
    this.survivalAcc +=
      (AA.survivalPtsPerSec +
        this.weaponTier * AA.tierHoldBonusPerSec * 0.35) *
      (delta / 1000)
    while (this.survivalAcc >= 1) {
      this.survivalAcc -= 1
      this.addScore(1)
    }
    // decay combo display
    if (this.combo > 0 && this.time.now - this.lastKillAt > AA.comboWindowMs) {
      this.combo = 0
      this.comboMult = 1
      this.hudCombo.setText('')
    }
  }

  private addScore(amount: number) {
    const prev = this.score
    this.score += amount
    if (this.score === prev) return
    this.hudScore.setText(`SCORE  ${this.score}`)
    if (
      this.score >= AMENDMENT_REWARD_THRESHOLD &&
      prev < AMENDMENT_REWARD_THRESHOLD
    ) {
      this.hudScore.setColor('#d4922a')
      this.cameras.main.flash(90, 208, 146, 42, false)
      floatScoreText(this, this.ship.x, this.ship.y - 50, 'THRESHOLD!', '#d4922a')
    }
    if (this.score > this.bestScore) {
      const was = this.bestScore
      this.bestScore = this.score
      if (was > 0) {
        this.newBestBanner.setAlpha(0).setScale(0.7)
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
              y: 56,
              delay: 700,
              duration: 350,
              onComplete: () => this.newBestBanner.setY(80),
            })
          },
        })
      }
    }
    this.emitScore(this.score)
  }

  // ── bridge ─────────────────────────────────────────────

  private getBridge(): AmendmentBridge | null {
    return (
      (this.game.registry.get('amendmentBridge') as AmendmentBridge | undefined) ??
      null
    )
  }

  private emitScore(score: number) {
    this.getBridge()?.onScoreChange(score)
  }

  private emitState(state: AmendmentGameState) {
    this.getBridge()?.onStateChange(state)
  }

  private emitTier() {
    this.getBridge()?.onTierChange?.(this.weaponTier)
  }
}
