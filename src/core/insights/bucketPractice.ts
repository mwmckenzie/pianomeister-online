import type { BucketUnit } from './BucketUnit'
import type { PracticeBucket } from './PracticeBucket'
import type { RangeWindow } from './RangeWindow'
import { shiftDayKey } from './shiftDayKey'
import { weekStartKey } from './weekStartKey'

/**
 * Practice per day, week (starting on `weekStart`) or month across a window, oldest first, the
 * last bucket being the current one. Weeks and months are clipped to the window.
 */
export function bucketPractice(
  byDay: ReadonlyMap<string, number>,
  window: RangeWindow,
  unit: BucketUnit,
  weekStart: number,
): readonly PracticeBucket[] {
  const bucketOf = (key: string): string => {
    if (unit === 'day') return key
    if (unit === 'week') return weekStartKey(key, weekStart)
    return key.slice(0, 7) + '-01'
  }
  const buckets = new Map<string, number>()
  for (let i = 0; i < window.days; i++) {
    const key = shiftDayKey(window.from, i)
    const bucket = bucketOf(key)
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + (byDay.get(key) ?? 0))
  }
  const current = bucketOf(window.to)
  return [...buckets].map(([key, ms]) => ({
    key: key < window.from ? window.from : key,
    ms,
    current: key === current,
  }))
}
