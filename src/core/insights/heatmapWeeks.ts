import type { HeatmapCell } from './HeatmapCell'
import { heatmapLevel } from './heatmapLevel'
import { shiftDayKey } from './shiftDayKey'
import { weekStartKey } from './weekStartKey'

/**
 * A practice calendar: `weeks` columns, oldest first, each the seven days of one calendar week
 * (starting on `weekStart`), the last column being the current week.
 */
export function heatmapWeeks(
  byDay: ReadonlyMap<string, number>,
  today: string,
  weeks: number,
  weekStart: number,
): readonly (readonly HeatmapCell[])[] {
  const first = shiftDayKey(weekStartKey(today, weekStart), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const key = shiftDayKey(first, w * 7 + d)
      const ms = byDay.get(key) ?? 0
      return { key, ms, level: heatmapLevel(ms), today: key === today, future: key > today }
    }),
  )
}
