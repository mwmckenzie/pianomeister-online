export interface BarPosition {
  readonly bar: number
  /** 1-based. */
  readonly beat: number
  /** Progress through the beat, 0 ≤ beatFraction < 1. */
  readonly beatFraction: number
}
