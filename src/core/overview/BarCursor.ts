/**
 * The overview's keyboard state (brief decision 104): a bar cursor and, while Shift extends a
 * selection, the bar it started from.
 */
export interface BarCursor {
  readonly bar: number
  readonly anchor: number | null
}
