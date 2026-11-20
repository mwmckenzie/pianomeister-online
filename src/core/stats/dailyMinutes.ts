import { dayKeyOf } from '../insights/dayKeyOf'
import { practiceByDay } from '../insights/practiceByDay'
import { shiftDayKey } from '../insights/shiftDayKey'
import type { PlayRecord } from './PlayRecord'

const MS_PER_DAY = 86_400_000

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
  const today = dayKeyOf(timeZone)(now)
  // Records entirely before the window can be skipped; a day is at most 25 hours.
  const recent = records.filter((r) => r.startedAt + r.playedMs >= now - (days + 1) * MS_PER_DAY)
  const byDay = practiceByDay(recent, timeZone)
  return Array.from(
    { length: days },
    (_, i) => (byDay.get(shiftDayKey(today, -(days - 1 - i))) ?? 0) / 60_000,
  )
}
