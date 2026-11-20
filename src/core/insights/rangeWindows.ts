import type { RangeWindow } from './RangeWindow'
import { shiftDayKey } from './shiftDayKey'
import type { StatsRange } from './StatsRange'

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1

/**
 * The window a stats range covers, ending today, and the one of the same length just before it
 * (for "vs previous 30 days"). 12 months runs from the same date a year ago, the day after. "All"
 * starts at the first practised day (or today) and has no previous window.
 */
export function rangeWindows(
  range: StatsRange,
  today: string,
  firstDay: string | null,
): { readonly current: RangeWindow; readonly previous: RangeWindow | null } {
  let from: string
  if (range === 'all') from = firstDay !== null && firstDay < today ? firstDay : today
  else if (range === '12m') {
    const [y, m, d] = today.split('-')
    from = shiftDayKey(`${Number(y) - 1}-${m}-${d}`, 1)
  } else from = shiftDayKey(today, range === '7d' ? -6 : -29)
  const days = daysBetween(from, today)
  const current = { from, to: today, days }
  if (range === 'all') return { current, previous: null }
  const previousTo = shiftDayKey(from, -1)
  return {
    current,
    previous: { from: shiftDayKey(previousTo, -(days - 1)), to: previousTo, days },
  }
}
