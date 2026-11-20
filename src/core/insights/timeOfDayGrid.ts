import type { PlayRecord } from '../stats/PlayRecord'
import { splitByKey } from './splitByKey'

/** The band index of a local hour: morning 5–11, midday 11–14, afternoon 14–18, evening 18–23, night 23–5. */
function bandOf(hour: number): number {
  if (hour >= 5 && hour < 11) return 0
  if (hour >= 11 && hour < 14) return 1
  if (hour >= 14 && hour < 18) return 2
  if (hour >= 18 && hour < 23) return 3
  return 4
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Practice time (ms) per local weekday (row 0 = Sunday) and time-of-day band (TIME_BANDS), a
 * stretch split at band and day boundaries.
 */
export function timeOfDayGrid(
  records: readonly PlayRecord[],
  timeZone?: string,
): readonly (readonly number[])[] {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  })
  const keyOf = (ms: number): string => {
    const parts = format.formatToParts(ms)
    const weekday = WEEKDAYS.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Sun')
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
    return String(weekday) + '|' + String(bandOf(hour))
  }
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 5 }, () => 0))
  for (const r of records) {
    splitByKey(r.startedAt, r.startedAt + r.playedMs, keyOf, (key, ms) => {
      const [weekday = 0, band = 0] = key.split('|').map(Number)
      const row = grid[weekday]
      if (row !== undefined) row[band] = (row[band] ?? 0) + ms
    })
  }
  return grid
}
