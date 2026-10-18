import { describe, expect, it } from 'vitest'
import {
  TOP_MODE,
  eliteHp,
  enemyFireInterval,
  hpBonus,
  overdriveHeat,
  spawnIntervalFactor,
  speedFactor,
  stepOverdrive,
} from '../src/games/AmendmentApocalypse/topMode'

describe('Amendment Apocalypse overdrive (top mode)', () => {
  it('is fully neutral below max tier (early game unchanged)', () => {
    const h = overdriveHeat(0, false)
    expect(h).toBe(0)
    expect(spawnIntervalFactor(h)).toBe(1)
    expect(speedFactor(h)).toBe(1)
    for (const k of ['null', 'race', 'loop', 'corrupt'] as const) expect(hpBonus(k, h)).toBe(0)
    expect(enemyFireInterval(h)).toBe(Number.POSITIVE_INFINITY)
  })

  it('keeps a cooling residue after dropping below max tier', () => {
    const full = overdriveHeat(TOP_MODE.rampSeconds * 1000, true)
    expect(overdriveHeat(TOP_MODE.rampSeconds * 1000, false)).toBeCloseTo(full * TOP_MODE.coolingHeatMult)
  })

  it('starts at base heat and ramps to 1 while held at max tier', () => {
    expect(overdriveHeat(1, true)).toBeCloseTo(TOP_MODE.baseHeat, 2)
    expect(overdriveHeat(TOP_MODE.rampSeconds * 500, true)).toBeGreaterThan(TOP_MODE.baseHeat)
    expect(overdriveHeat(TOP_MODE.rampSeconds * 1000, true)).toBe(1)
    expect(overdriveHeat(TOP_MODE.rampSeconds * 5000, true)).toBe(1)
  })

  it('clock grows at max tier and cools faster below it', () => {
    expect(stepOverdrive(1000, true, 16)).toBe(1016)
    expect(stepOverdrive(1000, false, 100)).toBe(1000 - 100 * TOP_MODE.coolRate)
    expect(stepOverdrive(10, false, 100)).toBe(0)
  })

  it('scales pressure monotonically with heat', () => {
    expect(spawnIntervalFactor(1)).toBe(TOP_MODE.spawnIntervalAtFull)
    expect(speedFactor(1)).toBeCloseTo(TOP_MODE.speedAtFull)
    expect(hpBonus('corrupt', 1)).toBe(TOP_MODE.corruptHpBonus)
    expect(hpBonus('null', 1)).toBe(1)
    expect(hpBonus('race', 1)).toBe(0)
    expect(enemyFireInterval(1)).toBe(TOP_MODE.fireMinMs)
    expect(enemyFireInterval(0.4)).toBeGreaterThan(enemyFireInterval(0.9))
    expect(eliteHp(1)).toBeGreaterThan(eliteHp(0.35))
  })
})

describe('overdrive anti-farm scoring', async () => {
  const { killScoreMult, comboCap } = await import('../src/games/AmendmentApocalypse/topMode')
  it('is neutral below max tier and shrinks at full heat', () => {
    expect(killScoreMult(0)).toBe(1)
    expect(comboCap(4, 0)).toBe(4)
    expect(killScoreMult(1)).toBeCloseTo(0.2)
    expect(comboCap(4, 1)).toBeCloseTo(1)
  })
})
