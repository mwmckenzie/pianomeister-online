import type { BarSpan } from './BarSpan'

/** A song's bars along the overview's x-axis. */
export interface BarLayout {
  readonly bars: readonly BarSpan[]
  readonly firstBar: number
  readonly lastBar: number
  /** The first bar's start and the last bar's end: the whole song. */
  readonly startTick: number
  readonly endTick: number
  /** The narrowest view: 4 of its shortest bars (or the whole song if shorter). */
  readonly minSpan: number
}
