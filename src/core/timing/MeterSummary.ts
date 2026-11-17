import type { MeterChange } from './MeterChange'

/** How a song's meter reads in the picker and library details. */
export interface MeterSummary {
  /** The meter covering the most bars, e.g. "3/4". */
  readonly main: string
  /** How many times the meter changes (runs.length - 1). */
  readonly changes: number
  /** Each run of one meter, in bar order; the first starts at bar 1. */
  readonly runs: readonly MeterChange[]
}
