import type { CrossfadeCurve } from './CrossfadeCurve'

/** Where two songs overlap on the highway (timeline ticks), and how the ending one fades. */
export interface CrossfadeBand {
  readonly startTick: number
  readonly endTick: number
  /** The ending song's deck. */
  readonly deck: number
  readonly curve: CrossfadeCurve
}
