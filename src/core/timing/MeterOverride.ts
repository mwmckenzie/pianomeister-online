import type { TimeSignature } from './TimeSignature'

/** Replaces the file's time signatures; anything before barOneStartTick becomes bar 0. */
export interface MeterOverride {
  readonly timeSignature: TimeSignature
  readonly barOneStartTick: number
}
