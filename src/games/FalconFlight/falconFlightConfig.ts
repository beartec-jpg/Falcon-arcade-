/** Falcon Flight tuning + brand colors (portal-aligned). */

export const FALCON_FLIGHT_SLUG = 'falcon-flight'

/** Score required to enable the Game Faucet claim for this game (best single run). */
export const FALCON_FLIGHT_REWARD_THRESHOLD = 500

export const FALCON_COLORS = {
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
  text: 0xf1f5f9,
  textMuted: 0x94a3b8,
  danger: 0xf87171,
  star: 0x64748b,
} as const

export const FALCON_FLIGHT = {
  width: 960,
  height: 540,
  /** Fixed horizontal position of the falcon (world does the scrolling). */
  playerX: 170,
  /** Design height used when authoring gap/speed values. */
  designHeight: 540,
  /** Tight body hitbox (wings are visual-only). */
  playerRadius: 11,
  verticalSpeed: 340,
  /** Base world scroll speed (px/s). */
  baseScrollSpeed: 180,
  maxScrollSpeed: 360,
  /** Gap height range between ledger blocks (at designHeight). */
  gapMax: 260,
  gapMin: 168,
  /** Time between obstacle spawns (ms). */
  spawnMaxMs: 2100,
  spawnMinMs: 1150,
  /** Distance score: points per second of survival at base speed (scaled by speed). */
  distancePointsPerSecond: 5,
  /** Bonus when the player fully clears a gap. */
  gapPassBonus: 12,
  /** How quickly difficulty ramps (0–1 over this many seconds). */
  difficultyRampSeconds: 90,
} as const

export type FalconFlightGameState = 'ready' | 'playing' | 'gameover'

export type FalconFlightBridge = {
  onScoreChange: (score: number) => void
  onStateChange: (state: FalconFlightGameState) => void
}
