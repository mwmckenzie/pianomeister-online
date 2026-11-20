/** One bar of the minutes chart: a day, a week (from its first day) or a month. */
export interface PracticeBucket {
  /** The bucket's first day ("YYYY-MM-DD"), clipped to the window. */
  readonly key: string
  readonly ms: number
  /** Today, or the current week or month. */
  readonly current: boolean
}
