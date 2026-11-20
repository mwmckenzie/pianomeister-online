/** The stats page's six headline numbers for a window (m7-7 decision 15). */
export interface HeadlineNumbers {
  readonly playedMs: number
  readonly sessions: number
  readonly averageSessionMs: number
  readonly daysPractised: number
  /** Days in the window ("17 of 30"). */
  readonly days: number
  readonly plays: number
  readonly longestStreak: number
}
