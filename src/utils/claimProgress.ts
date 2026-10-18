/** Claim threshold / per-run credit cap (portal defaults; the portal's PROGRESS_UPDATE wins). */
export const ARCADE_CLAIM_THRESHOLD = 500

export type RunState = { runId: string; last: number; credit: number }

export function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Local claim-progress step for a reported score. Each run starts from zero, so a
 * score lower than the last reported one starts a new run. Only the rise within a
 * run is credited, capped at `cap` per run. Returns the next run state and how
 * many points to add to progress.
 */
export function stepRun(
  prev: RunState | undefined,
  score: number,
  makeId: () => string = newRunId,
  cap: number = ARCADE_CLAIM_THRESHOLD,
): { run: RunState; delta: number } {
  const base = !prev || score < prev.last ? { runId: makeId(), last: 0, credit: 0 } : prev
  const credit = Math.min(Math.max(0, Math.floor(score)), cap)
  const delta = Math.max(0, credit - base.credit)
  return { run: { runId: base.runId, last: score, credit: base.credit + delta }, delta }
}
