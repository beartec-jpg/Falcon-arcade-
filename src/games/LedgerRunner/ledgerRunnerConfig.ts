/** Ledger Runner tuning + portal-aligned brand colors. */

export const LEDGER_RUNNER_SLUG = 'ledger-runner'

/** Score required to enable the Game Faucet claim for this game (best single run). */
export const LEDGER_RUNNER_REWARD_THRESHOLD = 500

export const RUNNER_COLORS = {
  bg: 0x0f1b33,
  bgHex: '#0f1b33',
  panel: 0x0f172a,
  border: 0x1e293b,
  bronze: 0xc07838,
  bronzeBright: 0xd4922a,
  bronzeDark: 0xa06030,
  quantum: 0x22d3ee,
  quantumDim: 0x0e7490,
  ledger: 0x1e293b,
  ledgerFace: 0x334155,
  ground: 0x0f172a,
  groundLine: 0xc07838,
  text: 0xf1f5f9,
  textMuted: 0x94a3b8,
  danger: 0xf87171,
  star: 0x64748b,
  combo: 0xd4922a,
} as const

export const LEDGER_RUNNER = {
  width: 960,
  height: 540,
  /** Design height used when authoring ground/jump/obstacle values. */
  designHeight: 540,
  /** Fixed runner X — world scrolls left. */
  playerX: 160,
  playerW: 28,
  playerH: 40,
  slideH: 22,
  /** Ground Y at designHeight (scales with playfield). */
  groundY: 460,
  gravityY: 1600,
  jumpVelocity: -520,
  doubleJumpVelocity: -440,
  slideDurationMs: 420,
  /** Base world scroll speed (px/s). */
  baseScrollSpeed: 240,
  maxScrollSpeed: 420,
  spawnMaxMs: 2000,
  spawnMinMs: 1100,
  distancePointsPerSecond: 6,
  clearBonus: 10,
  perfectBonus: 6,
  comboStepBonus: 3,
  maxCombo: 12,
  difficultyRampSeconds: 75,
} as const

export type LedgerRunnerGameState = 'ready' | 'playing' | 'gameover'

export type LedgerRunnerBridge = {
  onScoreChange: (score: number) => void
  onStateChange: (state: LedgerRunnerGameState) => void
}
