/**
 * One song in a playlist (milestone 9.5). The same song may appear more than once. `lookId`
 * overrides the playlist's look for this song; null = the playlist's look.
 */
export interface PlaylistEntry {
  readonly songId: string
  readonly lookId: string | null
}
