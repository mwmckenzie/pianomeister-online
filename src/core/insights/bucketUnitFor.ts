import type { BucketUnit } from './BucketUnit'
import type { RangeWindow } from './RangeWindow'

/** The unit the minutes chart uses (m7-7 decision 16): days up to a month, weeks up to a year. */
export function bucketUnitFor(window: RangeWindow): BucketUnit {
  if (window.days <= 31) return 'day'
  if (window.days <= 366) return 'week'
  return 'month'
}
