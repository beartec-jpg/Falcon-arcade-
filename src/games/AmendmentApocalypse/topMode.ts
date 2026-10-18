/**
 * Amendment Apocalypse — "Overdrive" top-mode difficulty.
 *
 * Only active while the weapon is at max tier. Below max tier every factor
 * here is neutral (heat 0), so the early / mid game is unchanged.
 * Pure functions so they can be unit-tested and simulated headlessly.
 */
import type { BugKind } from './amendmentApocalypseConfig'

export const TOP_MODE = {
  /** Heat jumps to this the moment you hit max tier… */
  baseHeat: 0.35,
  /** …then ramps to 1 over this many seconds held at max tier. */
  rampSeconds: 60,
  /** Overdrive clock bleeds off at this rate when below max tier (1 = real time). */
  coolRate: 0.5,
  /** Residual heat multiplier while cooling below max tier (after overheat / a hit). */
  coolingHeatMult: 0.6,
  /** Spawn interval multiplier at full heat (lower = more spawns). */
  spawnIntervalAtFull: 0.5,
  /** Extra pack-spawn chance at full heat. */
  extraPackChance: 0.45,
  /** Enemy speed multiplier at full heat. */
  speedAtFull: 1.3,
  /** Corrupt HP bonus at full heat. */
  corruptHpBonus: 4,
  /** Above this heat small bugs (null/loop) take 2 hits. */
  toughSmallHeat: 0.6,
  /** Corrupt (and elite) enemy fire cadence, ms (full heat → min). */
  fireMaxMs: 2800,
  fireMinMs: 1300,
  enemyBulletSpeed: 150,
  /** Elite mini-boss cadence while in overdrive. */
  eliteEverySeconds: 25,
  eliteBaseHp: 22,
  eliteHpPerHeat: 18,
  elitePoints: 120,
  /** Continuous seconds at max tier before the weapon overheats (−1 tier). */
  overheatSeconds: 40,
} as const

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * 0 until max tier is first reached (early game untouched); baseHeat..1 while
 * held at max tier; a residual, cooling fraction after dropping below it so an
 * overheat / hit can't be used to reset into full-score late game.
 */
export function overdriveHeat(overdriveMs: number, atMaxTier: boolean): number {
  if (overdriveMs <= 0) return 0
  const t = clamp01(overdriveMs / (TOP_MODE.rampSeconds * 1000))
  const h = TOP_MODE.baseHeat + (1 - TOP_MODE.baseHeat) * t
  return atMaxTier ? h : h * TOP_MODE.coolingHeatMult
}

/** Advance the overdrive clock: grows at max tier, cools (faster) below it. */
export function stepOverdrive(overdriveMs: number, atMaxTier: boolean, deltaMs: number): number {
  if (atMaxTier) return overdriveMs + deltaMs
  return Math.max(0, overdriveMs - deltaMs * TOP_MODE.coolRate)
}

export function spawnIntervalFactor(heat: number): number {
  return 1 - (1 - TOP_MODE.spawnIntervalAtFull) * clamp01(heat)
}

export function speedFactor(heat: number): number {
  return 1 + (TOP_MODE.speedAtFull - 1) * clamp01(heat)
}

export function hpBonus(kind: BugKind, heat: number): number {
  if (heat <= 0) return 0
  if (kind === 'corrupt') return Math.round(TOP_MODE.corruptHpBonus * heat)
  if ((kind === 'null' || kind === 'loop') && heat >= TOP_MODE.toughSmallHeat) return 1
  return 0
}

/** ms between shots for a firing enemy; Infinity when not in overdrive. */
export function enemyFireInterval(heat: number): number {
  if (heat <= 0) return Number.POSITIVE_INFINITY
  return TOP_MODE.fireMaxMs + (TOP_MODE.fireMinMs - TOP_MODE.fireMaxMs) * clamp01(heat)
}

export function eliteHp(heat: number): number {
  return Math.round(TOP_MODE.eliteBaseHp + TOP_MODE.eliteHpPerHeat * clamp01(heat))
}

/**
 * Anti-farm: maxed weapons clear the screen with constant combos, so kill
 * points and the combo cap shrink as overdrive heats up. 1 / uncapped below max tier.
 */
export const TOP_MODE_SCORE = {
  /** Kill-point multiplier at full heat. */
  killMultAtFull: 0.2,
  /** Combo multiplier cap at full heat (normal cap is AA.maxComboMult). */
  comboCapAtFull: 1,
} as const

export function killScoreMult(heat: number): number {
  return 1 - (1 - TOP_MODE_SCORE.killMultAtFull) * clamp01(heat)
}

export function comboCap(normalCap: number, heat: number): number {
  return normalCap + (TOP_MODE_SCORE.comboCapAtFull - normalCap) * clamp01(heat)
}
