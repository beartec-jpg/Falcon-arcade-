/** Ledger Runner tuning + portal-aligned brand colors. */

export const LEDGER_RUNNER_SLUG = 'ledger-runner'

/** Score required to enable the Game Faucet claim for this game. */
export const LEDGER_RUNNER_REWARD_THRESHOLD = 100

export const RUNNER_COLORS = {
  bg: 0x020617,
  bgHex: '#020617',
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
  /** Fixed runner X — world scrolls left. */
  playerX: 160,
  playerW: 28,
  playerH: 40,
  slideH: 22,
  groundY: 460,
  gravityY: 1600,
  jumpVelocity: -520,
  doubleJumpVelocity: -440,
  slideDurationMs: 420,
  /** Base world scroll speed (px/s). */
  baseScrollSpeed: 260,
  maxScrollSpeed: 520,
  spawnMaxMs: 1800,
  spawnMinMs: 900,
  distancePointsPerSecond: 10,
  clearBonus: 12,
  perfectBonus: 8,
  comboStepBonus: 4,
  maxCombo: 12,
  difficultyRampSeconds: 75,
} as const

export type LedgerRunnerGameState = 'ready' | 'playing' | 'gameover'

export type LedgerRunnerBridge = {
  onScoreChange: (score: number) => void
  onStateChange: (state: LedgerRunnerGameState) => void
}
