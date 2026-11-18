const PREFIX = 'full:'

/** The id "Full song" is tracked under in the play log (brief decision 68). */
export function fullSongId(songId: string): string {
  return `${PREFIX}${songId}`
}

export function isFullSongId(entryId: string): boolean {
  return entryId.startsWith(PREFIX)
}
