import { shiftDayKey } from './shiftDayKey'
import { weekdayOfKey } from './weekdayOfKey'

/** The first day of the calendar week containing `key`, weeks starting on `weekStart` (0 = Sunday). */
export function weekStartKey(key: string, weekStart: number): string {
  return shiftDayKey(key, -((weekdayOfKey(key) - weekStart + 7) % 7))
}
