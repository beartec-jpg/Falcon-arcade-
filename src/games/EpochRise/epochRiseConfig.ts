/** Epoch Rise tuning + portal-aligned brand colors. */

export const EPOCH_RISE_SLUG = 'epoch-rise'

/** Score required to enable the Game Faucet claim for this game (best single run). */
export const EPOCH_RISE_REWARD_THRESHOLD = 500

export const EPOCH_COLORS = {
  bg: 0x0f1b33,
  bgHex: '#0f1b33',
  panel: 0x0f172a,
  border: 0x1e293b,
  bronze: 0xc07838,
  bronzeBright: 0xd4922a,
  bronzeDark: 0xa06030,
  quantum: 0x22d3ee,
  quantumDim: 0x0e7490,
  quantumHot: 0x67e8f9,
  ledger: 0x1e293b,
  ledgerFace: 0x334155,
  danger: 0xf87171,
  shield: 0xa78bfa,
  boost: 0xd4922a,
  energy: 0x22d3ee,
  energyLow: 0xf87171,
  text: 0xf1f5f9,
  textMuted: 0x94a3b8,
  star: 0x64748b,
} as const

export const EPOCH_RISE = {
  width: 960,
  height: 540,
  /** Falcon stays near mid-lower screen; world scrolls down (rise illusion). */
  playerY: 360,
  playerRadius: 16,
  lateralSpeed: 340,
  boostSpeed: 520,
  boostDurationMs: 280,
  boostEnergyCost: 6,
  /** World scroll speed (px/s) — higher = faster rise. */
  baseRiseSpeed: 140,
  maxRiseSpeed: 300,
  maxEnergy: 100,
  /** Passive energy drain per second at difficulty 0 → 1. */
  baseDrainPerSecond: 3.2,
  maxDrainPerSecond: 7.5,
  ledgerHitDrain: 18,
  interferenceDrainPerSecond: 14,
  orbEnergy: 14,
  orbScore: 8,
  clusterOrbEnergy: 8,
  clusterOrbScore: 10,
  heightPointsPerSecond: 4,
  efficiencyBonusThreshold: 70,
  efficiencyPointsPerSecond: 1.5,
  shieldDurationMs: 3200,
  boostZoneDurationMs: 2200,
  spawnMaxMs: 1300,
  spawnMinMs: 700,
  difficultyRampSeconds: 80,
} as const

export type EpochRiseGameState = 'ready' | 'playing' | 'gameover'

export type EpochRiseBridge = {
  onScoreChange: (score: number) => void
  onStateChange: (state: EpochRiseGameState) => void
  onEnergyChange?: (energy: number, max: number) => void
}
