/** What Welcome (shown over the player, m7-7 decision 12) asks the player to do. */
export interface PlayerActions {
  /** Back to the player, paused where it is: the resume entry is already loaded there. */
  resume(): void
  /** Loads a song (and bookmark, or Full song) and opens the player. */
  play(songId: string, bookmarkId: string | null): Promise<void>
  /** The song picker, over Welcome; loading from it opens the player. */
  choose(): void
  /** The player with the playfield panel open. */
  openPlayfield(): void
  /** The settings window, on a tab. */
  openSettings(tab?: 'profiles'): void
}
