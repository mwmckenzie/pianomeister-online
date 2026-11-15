import type { HandNote } from '@/core/hands/HandNote'
import type { BarMap } from '@/core/timing/BarMap'

/** What the engine draws for one song. Rebuild it when hands or the meter override change. */
export interface EngineSong {
  /** Hand-assigned notes only: unassigned channels are hidden. */
  readonly notes: readonly HandNote[]
  readonly ppq: number
  readonly barMap: BarMap
  /** Pedal-down spans of the assigned channels (merged by the engine). */
  readonly pedalIntervals: readonly { readonly startTick: number; readonly endTick: number }[]
  readonly endTick: number
}
