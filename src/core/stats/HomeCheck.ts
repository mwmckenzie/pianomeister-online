/** What decides whether the app switches to Home (milestone 9.2 D). */
export interface HomeCheck {
  readonly now: number
  /** When the active profile's playback last ended (the play log), or null if it never played. */
  readonly lastPlaybackEnd: number | null
  /** When Home was last opened this way (stored per profile), or null. */
  readonly lastAutoOpen: number | null
  readonly gapMs: number
}
