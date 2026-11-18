/** Stats for a song, a bookmark or Full song, computed from the play log. */
export interface PracticeTotals {
  readonly plays: number
  readonly playedMs: number
  /** When the last stretch ended (epoch ms), or null if never played. */
  readonly lastPlayedAt: number | null
}
