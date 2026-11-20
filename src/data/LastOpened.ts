/** A profile's last opened song, and the bookmark loaded with it (null = Full song). */
export interface LastOpened {
  readonly songId: string
  readonly bookmarkId: string | null
  /**
   * Where playback last stopped (a bar), kept for Welcome's Resume (m7-7 decision 6); updated
   * when playback pauses or stops and when the page is left. Missing until then.
   */
  readonly bar?: number
}
