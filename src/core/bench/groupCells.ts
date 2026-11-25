import type { BenchCell } from './BenchCell'
import type { CellResult } from './BenchResult'
import { cellKey } from './cellKey'

/** A cell's rounds together: the mean of each number, and how far the rounds were apart. */
export interface CellGroup {
  readonly key: string
  readonly cell: BenchCell
  readonly median: number
  readonly p95: number
  readonly p99: number
  readonly longest: number
  readonly dropped: number
  readonly fps: number
  readonly cpu: number
  readonly hud: number
  readonly gpuMs: number | null
  readonly drawCalls: number
  readonly late: number
  readonly missing: number | null
  /** Largest round over the smallest, minus one, of the p95 (0 with one round). */
  readonly spread: number
}

const NOISY = 0.1
export const isNoisy = (group: CellGroup): boolean => group.spread > NOISY

export function groupCells(cells: readonly CellResult[]): readonly CellGroup[] {
  const groups = new Map<string, CellResult[]>()
  for (const c of cells) {
    const key = cellKey(c.cell)
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups].map(([key, rounds]) => {
    const mean = (pick: (c: CellResult) => number) =>
      rounds.reduce((sum, c) => sum + pick(c), 0) / rounds.length
    const nullable = (pick: (c: CellResult) => number | null) =>
      rounds.some((c) => pick(c) === null) ? null : mean((c) => pick(c) ?? 0)
    const p95s = rounds.map((c) => c.frames.p95)
    const low = Math.min(...p95s)
    return {
      key,
      cell: (rounds[0] as CellResult).cell,
      median: mean((c) => c.frames.median),
      p95: mean((c) => c.frames.p95),
      p99: mean((c) => c.frames.p99),
      longest: Math.max(...rounds.map((c) => c.frames.longest)),
      dropped: mean((c) => c.frames.dropped),
      fps: mean((c) => c.frames.fps),
      cpu: mean((c) => c.cpu.median),
      hud: mean((c) => c.hud.median),
      gpuMs: nullable((c) => c.gpuMs),
      drawCalls: mean((c) => c.renderer.drawCalls),
      late: rounds.reduce((sum, c) => sum + c.audio.late, 0),
      missing: nullable((c) => c.audio.missing),
      spread: low <= 0 ? 0 : Math.max(...p95s) / low - 1,
    }
  })
}
