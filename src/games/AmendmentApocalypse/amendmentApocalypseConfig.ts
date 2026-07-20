/** Amendment Apocalypse — rogue-code arena shooter. */

export const AMENDMENT_SLUG = 'amendment-apocalypse'
/** Best single-run score required for Game Faucet claim. */
export const AMENDMENT_REWARD_THRESHOLD = 500

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
  /** Spawning — ramps harder over time and harder still at high weapon tier */
  spawnMaxMs: 1400,
  spawnMinMs: 420,
  difficultyRampSeconds: 70,
  /** Extra spawn pressure when weapon is strong (tier 1..6 → 0..1) */
  highTierSpawnMult: 0.55,
  /** Max Amendments + Hard Forks allowed on the field at once */
  maxPickupsOnField: 2,
  /** Drop rates (corrupt is higher; both fall as tier rises) */
  amendDropBase: 0.07,
  amendDropCorrupt: 0.22,
  hardForkDropBase: 0.015,
  /** Scoring — tuned so claim (~500) needs a real run, not a few seconds */
  survivalPtsPerSec: 3,
  killBase: 6,
  comboWindowMs: 1400,
  comboStep: 0.25,
  maxComboMult: 4,
  tierHoldBonusPerSec: 1,
  hardForkFireBoostMs: 3500,
  hardForkFireMult: 0.55,
} as const

export type AmendmentGameState = 'ready' | 'playing' | 'gameover'

export type AmendmentBridge = {
  onScoreChange: (score: number) => void
  onStateChange: (state: AmendmentGameState) => void
  onTierChange?: (tier: number) => void
}

export type BugKind = 'null' | 'race' | 'loop' | 'corrupt'
