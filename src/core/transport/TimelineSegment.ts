import type { PreRollWindow } from './PreRollWindow'

/**
 * A stretch of clock time that maps linearly onto song time. A loop wrap starts a new segment,
 * so a scheduler can see across the wrap: songTime = songStart + (clockTime − clockStart) · rate.
 */
export interface TimelineSegment {
  readonly clockStart: number
  readonly clockEnd: number
  readonly songStart: number
  readonly songEnd: number
  readonly rate: number
  /** The count-in active in this segment, if any. */
  readonly preRoll: PreRollWindow | null
  /** Notes must stop sounding by this song time (the loop end while looping), else null. */
  readonly soundLimitSec: number | null
}
