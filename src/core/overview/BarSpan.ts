/** One bar of the overview, in ticks (musical time: bars of different meters differ in width). */
export interface BarSpan {
  readonly bar: number
  readonly startTick: number
  /** Exclusive: the next bar's start. */
  readonly endTick: number
  /** Beat starts after the bar's own start (the editor's faint beat lines). */
  readonly beatTicks: readonly number[]
  /** Every 4th bar from bar 1 (1, 5, 9…): a stronger line. */
  readonly strong: boolean
}
