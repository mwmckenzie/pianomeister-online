import type { BenchRun } from '@/core/bench/BenchResult'
import { readBenchRun } from '@/core/bench/readBenchRun'

const STORAGE_KEY = 'pianomeister.bench'
const KEPT = 6

/** A run without its raw frames: what's kept here and in the repo. */
export function withoutFrames(run: BenchRun): BenchRun {
  return {
    ...run,
    cells: run.cells.map((cell) => {
      const { intervals: _, ...rest } = cell
      return rest
    }),
  }
}

/** The runs kept on this device, newest first. */
export function readHistory(): readonly BenchRun[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(readBenchRun).filter((r) => typeof r !== 'string')
  } catch {
    return []
  }
}

/** Keeps a run; as many of the older ones as there's room for stay. */
export function keepRun(run: BenchRun): void {
  let runs = [withoutFrames(run), ...readHistory()].slice(0, KEPT)
  while (runs.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
      return
    } catch {
      runs = runs.slice(0, -1)
    }
  }
}
