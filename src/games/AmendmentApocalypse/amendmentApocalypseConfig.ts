/** Amendment Apocalypse — rogue-code arena shooter. */

export const AMENDMENT_SLUG = 'amendment-apocalypse'
export const AMENDMENT_REWARD_THRESHOLD = 100

export const AA_COLORS = {
  bg: 0x020617,
  bgHex: '#020617',
  panel: 0x0f172a,
  border: 0x1e293b,
  bronze: 0xc07838,
  bronzeBright: 0xd4922a,
  bronzeDark: 0xa06030,
  quantum: 0x22d3ee,
  quantumHot: 0x67e8f9,
  shield: 0xa78bfa,
  danger: 0xf87171,
  nullBug: 0x94a3b8,
  raceBug: 0xfbbf24,
  loopBug: 0x34d399,
  corrupt: 0xf472b6,
  hardFork: 0xf0c14a,
  text: 0xf1f5f9,
  textMuted: 0x94a3b8,
} as const

export const AA = {
  width: 960,
  height: 540,
  /** Ship physics */
  accel: 420,
  maxSpeed: 280,
  drag: 0.985,
  /** Touch / pointer steer strength */
  touchAccel: 520,
  /** Always-firing weapon base */
  baseFireMs: 320,
  minFireMs: 90,
  bulletSpeed: 420,
  bulletLifeMs: 1400,
  /** Consensus */
  shieldMs: 2000,
  maxWeaponTier: 6,
  /** Spawning */
  spawnMaxMs: 1600,
  spawnMinMs: 650,
  difficultyRampSeconds: 90,
  /** Scoring */
  survivalPtsPerSec: 4,
  killBase: 8,
  comboWindowMs: 1400,
  comboStep: 0.25,
  maxComboMult: 4,
  tierHoldBonusPerSec: 1.5,
  hardForkFireBoostMs: 4000,
  hardForkFireMult: 0.55,
} as const

export type AmendmentGameState = 'ready' | 'playing' | 'gameover'

export type AmendmentBridge = {
  onScoreChange: (score: number) => void
  onStateChange: (state: AmendmentGameState) => void
  onTierChange?: (tier: number) => void
}

export type BugKind = 'null' | 'race' | 'loop' | 'corrupt'
