import { describe, expect, it } from 'vitest'
import { stepRun, type RunState } from '../src/utils/claimProgress'

function play(scores: number[]) {
  let run: RunState | undefined
  let progress = 0
  let n = 0
  const ids = new Set<string>()
  for (const s of scores) {
    const r = stepRun(run, s, () => `run${n++}`)
    run = r.run
    progress += r.delta
    ids.add(run.runId)
  }
  return { progress, runs: ids.size }
}

describe('stepRun (runs add up toward the claim)', () => {
  it('490 then a new run of 30 reaches 520', () => {
    expect(play([0, 100, 490, 0, 10, 30])).toEqual({ progress: 520, runs: 2 })
  })
  it('repeat posts in one run do not double count', () => {
    expect(play([200, 200, 300, 300])).toEqual({ progress: 300, runs: 1 })
  })
  it('caps a single run at the threshold', () => {
    expect(play([0, 2000])).toEqual({ progress: 500, runs: 1 })
  })
})
