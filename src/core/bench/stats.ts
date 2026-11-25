import type { CostStats, FrameStats } from './BenchResult'

const round = (x: number, digits = 2) => Number(x.toFixed(digits))

/** The nearest-rank percentile (0–100); 0 for no values. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))] as number
}

/**
 * The frame budget: the screen's own interval, or a 60 Hz frame where the screen is faster. A
 * 120 Hz screen is judged at 60.
 */
export const frameBudget = (refreshMs: number): number => Math.max(1000 / 60, refreshMs)

export function frameStats(intervals: readonly number[], refreshMs: number): FrameStats {
  const total = intervals.reduce((a, b) => a + b, 0)
  const share = (over: number) =>
    intervals.length === 0
      ? 0
      : round(intervals.filter((i) => i > over).length / intervals.length, 4)
  return {
    frames: intervals.length,
    fps: total === 0 ? 0 : round((intervals.length * 1000) / total, 1),
    median: round(percentile(intervals, 50)),
    p95: round(percentile(intervals, 95)),
    p99: round(percentile(intervals, 99)),
    longest: round(intervals.reduce((a, b) => Math.max(a, b), 0)),
    over17: share(17),
    over18: share(18),
    over34: share(34),
    over35: share(35),
    dropped: share(1.5 * frameBudget(refreshMs)),
  }
}

export function costStats(values: readonly number[]): CostStats {
  return { median: round(percentile(values, 50), 3), p95: round(percentile(values, 95), 3) }
}
