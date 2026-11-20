/** One day in a practice calendar. */
export interface HeatmapCell {
  readonly key: string
  readonly ms: number
  readonly level: 0 | 1 | 2 | 3 | 4
  readonly today: boolean
  /** After today (the rest of the current week): drawn empty, not as "no practice". */
  readonly future: boolean
}
