import type { PlayRecord } from '../stats/PlayRecord'
import { dayKeyOf } from './dayKeyOf'
import type { RangeWindow } from './RangeWindow'

/** The records that started on a day of the window (plays and sessions count where they start). */
export function recordsInWindow(
  records: readonly PlayRecord[],
  window: RangeWindow,
  timeZone?: string,
): readonly PlayRecord[] {
  const keyOf = dayKeyOf(timeZone)
  return records.filter((r) => {
    const key = keyOf(r.startedAt)
    return key >= window.from && key <= window.to
  })
}
