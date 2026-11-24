import type { Playlist } from './Playlist'

/**
 * The Welcome "Listen" card's playlists (milestone 9.5 E1): the most recently played first,
 * then those never played, newest first; at most `count`.
 */
export function recentPlaylists(playlists: readonly Playlist[], count = 3): readonly Playlist[] {
  return [...playlists]
    .sort((a, b) => {
      const played = (b.lastPlayedAt ?? -1) - (a.lastPlayedAt ?? -1)
      return played !== 0 ? played : b.createdAt.localeCompare(a.createdAt)
    })
    .slice(0, count)
}
