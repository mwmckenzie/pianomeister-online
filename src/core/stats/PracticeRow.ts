import type { PracticeTotals } from './PracticeTotals'

/** A row's practice data for sorting: totals plus, for songs, the bookmark count. */
export interface PracticeRow extends PracticeTotals {
  readonly bookmarks?: number
}
