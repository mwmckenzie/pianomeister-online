import { shiftDayKey } from './shiftDayKey'

/**
 * Days in a row with practice (m7-7 decision 8): `current` counts back from today, or from
 * yesterday while today has none yet (a streak isn't broken before the day is over); `longest`
 * is the longest run among the given days. Works on day keys, so DST never splits a run.
 */
export function practiceStreaks(
  days: ReadonlySet<string>,
  today: string,
): { readonly current: number; readonly longest: number } {
  let current = 0
  let day = days.has(today) ? today : shiftDayKey(today, -1)
  while (days.has(day)) {
    current++
    day = shiftDayKey(day, -1)
  }
  let longest = 0
  for (const key of days) {
    // Only count from the first day of each run.
    if (days.has(shiftDayKey(key, -1))) continue
    let length = 1
    while (days.has(shiftDayKey(key, length))) length++
    longest = Math.max(longest, length)
  }
  return { current, longest }
}
