import type { LaneRow } from './LaneRow'

/**
 * Stacks ranges into rows so overlapping ones never share a row (brief decision 105): sorted by
 * start bar (then the longer first), each takes the first row whose last range ended before it.
 * With `maxRows`, ranges that need more rows are left out and counted ("+N").
 */
export function stackLanes(
  ranges: readonly { readonly id: string; readonly startBar: number; readonly endBar: number }[],
  maxRows = Infinity,
): { readonly rows: readonly LaneRow[]; readonly rowCount: number; readonly hidden: number } {
  const sorted = [...ranges].sort(
    (a, b) => a.startBar - b.startBar || b.endBar - a.endBar || a.id.localeCompare(b.id),
  )
  const rowEnds: number[] = []
  const rows: LaneRow[] = []
  let hidden = 0
  for (const r of sorted) {
    let row = rowEnds.findIndex((end) => end < r.startBar)
    if (row < 0) row = rowEnds.length
    if (row >= maxRows) {
      hidden++
      continue
    }
    rowEnds[row] = r.endBar
    rows.push({ id: r.id, startBar: r.startBar, endBar: r.endBar, row })
  }
  return { rows, rowCount: rowEnds.length, hidden }
}
