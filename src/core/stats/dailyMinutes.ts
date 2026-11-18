import type { PlayRecord } from './PlayRecord'

const MS_PER_DAY = 86_400_000

/** "YYYY-MM-DD" of the calendar day containing `ms` in `timeZone`. */
function dayKeyFormatter(timeZone: string | undefined): (ms: number) => string {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return (ms) => format.format(ms)
}

/** The key `daysBack` calendar days before `key`, by date arithmetic (no DST involved). */
function shiftKey(key: string, daysBack: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - daysBack))
  return date.toISOString().slice(0, 10)
}

/** The first instant in (start, end] that falls on a later day than `start`. */
function nextDayStart(start: number, end: number, dayKey: (ms: number) => string): number {
  const startKey = dayKey(start)
  let lo = start
  let hi = end
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (dayKey(mid) === startKey) lo = mid
    else hi = mid
  }
  return hi
}

/**
 * Practice minutes per local calendar day for the last `days` days, oldest first and today
 * last (the 14-day chart, brief decision 71). A stretch that runs past midnight is split at
 * the day boundary. Days are calendar days in `timeZone` (default: the system's), so a 23- or
 * 25-hour day around a DST change is still one bar.
 */
export function dailyMinutes(
  records: readonly PlayRecord[],
  days: number,
  now: number,
  timeZone?: string,
): readonly number[] {
  const dayKey = dayKeyFormatter(timeZone)
  const today = dayKey(now)
  const keys = Array.from({ length: days }, (_, i) => shiftKey(today, days - 1 - i))
  const index = new Map(keys.map((key, i) => [key, i]))
  const ms: number[] = Array.from({ length: days }, () => 0)
  for (const record of records) {
    let start = record.startedAt
    const end = record.startedAt + record.playedMs
    // Records entirely before the window can be skipped; a day is at most 25 hours.
    if (end < now - (days + 1) * MS_PER_DAY) continue
    while (start < end) {
      const key = dayKey(start)
      const boundary = dayKey(end) === key ? end : nextDayStart(start, end, dayKey)
      const i = index.get(key)
      if (i !== undefined) ms[i] = (ms[i] ?? 0) + (boundary - start)
      start = boundary
    }
  }
  return ms.map((value) => value / 60_000)
}
