import type { BenchSegment } from './BenchCell'

/** Seconds before a cell's numbers count: programs compile and the player settles. */
export const WARM_UP_SEC = 1.5

/** Seconds measured per segment. */
export const SEGMENT_SEC: Readonly<Record<BenchSegment, number>> = {
  dense: 5,
  normal: 5,
  light: 5,
  loop: 6,
  crossfade: 8,
  pauseResume: 9,
  idle: 10,
}

/** A cell's setup (song, settings) and the pause before the next, roughly. */
const OVERHEAD_SEC = 0.6

export const cellSec = (segment: BenchSegment): number =>
  WARM_UP_SEC + SEGMENT_SEC[segment] + OVERHEAD_SEC
