/** A run of local calendar days, both ends included ("YYYY-MM-DD"). */
export interface RangeWindow {
  readonly from: string
  readonly to: string
  /** Days in the window. */
  readonly days: number
}
