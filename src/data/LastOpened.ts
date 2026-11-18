/** A profile's last opened song, and the bookmark loaded with it (null = Full song). */
export interface LastOpened {
  readonly songId: string
  readonly bookmarkId: string | null
}
