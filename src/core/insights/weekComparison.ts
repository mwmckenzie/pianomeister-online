import { shiftDayKey } from './shiftDayKey'
import { weekStartKey } from './weekStartKey'

/**
 * Welcome's "This week" (m7-7 decision 7): the calendar week so far (weeks starting on
 * `weekStart`), its seven days for the chart (days after today are null), and the change
 * against the same days of last week — null when last week had none of those days practised.
 */
export function weekComparison(
  byDay: ReadonlyMap<string, number>,
  today: string,
  weekStart: number,
): {
  readonly days: readonly { readonly key: string; readonly ms: number | null }[]
  readonly thisWeekMs: number
  readonly lastWeekMs: number
  readonly change: number | null
} {
  const start = weekStartKey(today, weekStart)
  const elapsed = Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = shiftDayKey(start, i)
    return { key, ms: i < elapsed ? (byDay.get(key) ?? 0) : null }
  })
  const thisWeekMs = days.reduce((n, d) => n + (d.ms ?? 0), 0)
  let lastWeekMs = 0
  for (let i = 0; i < elapsed; i++) lastWeekMs += byDay.get(shiftDayKey(start, i - 7)) ?? 0
  return {
    days,
    thisWeekMs,
    lastWeekMs,
    change: lastWeekMs > 0 ? (thisWeekMs - lastWeekMs) / lastWeekMs : null,
  }
}
