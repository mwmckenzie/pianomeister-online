import type { PlayRecord } from '../stats/PlayRecord'
import { dayKeyOf } from './dayKeyOf'
import { splitByKey } from './splitByKey'

/**
 * Practice time (ms) per local calendar day, every day that has any. A stretch running past
 * midnight is split at the day boundary.
 */
export function practiceByDay(
  records: readonly PlayRecord[],
  timeZone?: string,
): ReadonlyMap<string, number> {
  const keyOf = dayKeyOf(timeZone)
  const days = new Map<string, number>()
  for (const r of records) {
    splitByKey(r.startedAt, r.startedAt + r.playedMs, keyOf, (key, ms) =>
      days.set(key, (days.get(key) ?? 0) + ms),
    )
  }
  return days
}
