import type { BenchCell } from './BenchCell'

/** What makes two cells the same measurement; rounds of one cell share it. */
export const cellKey = (cell: BenchCell): string =>
  [cell.look.replace('builtin:', ''), cell.quality, cell.segment, cell.probe ?? ''].join(' | ')
