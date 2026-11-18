/** A profile's practice at a glance (brief decision 71). */
export interface ProfileSummary {
  readonly sessions: number
  readonly songsPracticed: number
  readonly playedMs: number
  /** By practice time; null when nothing was played. */
  readonly mostPracticedSongId: string | null
  readonly lastPlayedAt: number | null
  /** Practice time per session. */
  readonly averageSessionMs: number
}
