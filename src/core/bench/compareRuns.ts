import type { BenchRun } from './BenchResult'
import { groupCells } from './groupCells'

export interface CellChange {
  readonly key: string
  readonly metric: 'p95' | 'cpu' | 'gpuMs' | 'drawCalls'
  readonly before: number
  readonly after: number
  /** after / before − 1. */
  readonly change: number
}

export interface BenchComparison {
  /** Why the two can't simply be compared (another device, a development build). */
  readonly warnings: readonly string[]
  readonly shared: number
  /** Changes beyond the noise, largest first. */
  readonly changes: readonly CellChange[]
}

/** Differences smaller than this aren't told from noise, nor those under a timer step. */
const LEAST = 0.1
const LEAST_MS = 0.15

export function compareRuns(before: BenchRun, after: BenchRun): BenchComparison {
  const [a, b] = [before.device, after.device]
  const warnings = [
    a.gpu !== b.gpu && 'Different GPU',
    a.cores !== b.cores && 'Different processor',
    a.viewport.join() !== b.viewport.join() && 'Different window size',
    a.pixelRatio !== b.pixelRatio && 'Different pixel ratio',
    Math.abs(a.refreshMs - b.refreshMs) > 1 && 'Different refresh rate',
    (before.app.dev || after.app.dev) && 'A development build is not comparable',
  ].filter((w) => w !== false)
  const old = new Map(groupCells(before.cells).map((g) => [g.key, g]))
  const changes: CellChange[] = []
  let shared = 0
  for (const now of groupCells(after.cells)) {
    const was = old.get(now.key)
    if (was === undefined) continue
    shared++
    const noise = Math.max(LEAST, was.spread, now.spread)
    for (const metric of ['p95', 'cpu', 'gpuMs', 'drawCalls'] as const) {
      const x = was[metric]
      const y = now[metric]
      if (x === null || y === null || x <= 0) continue
      const change = y / x - 1
      const same =
        metric === 'drawCalls' ? x === y : Math.abs(change) <= noise || Math.abs(y - x) < LEAST_MS
      if (!same) changes.push({ key: now.key, metric, before: x, after: y, change })
    }
  }
  changes.sort((x, y) => Math.abs(y.change) - Math.abs(x.change))
  return { warnings, shared, changes }
}
