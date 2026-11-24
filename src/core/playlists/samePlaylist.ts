import type { Playlist } from './Playlist'

/** Same content (name, look, entries, shuffle, repeat), whatever the ids, dates and owner. */
export function samePlaylist(a: Playlist, b: Playlist): boolean {
  return (
    a.name === b.name &&
    a.lookId === b.lookId &&
    a.shuffle === b.shuffle &&
    a.repeat === b.repeat &&
    a.entries.length === b.entries.length &&
    a.entries.every(
      (e, i) => e.songId === b.entries[i]?.songId && e.lookId === b.entries[i]?.lookId,
    )
  )
}
