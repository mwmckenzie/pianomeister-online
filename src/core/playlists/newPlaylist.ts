import { uniqueLookName } from '../looks/uniqueLookName'
import type { Playlist } from './Playlist'

/**
 * A new, empty playlist (or one holding `songIds`): named `name`, made unique among `taken`
 * ("New playlist (2)"), with the current look, in order, repeating the playlist.
 */
export function newPlaylist(
  profileId: string,
  name: string,
  taken: readonly Playlist[],
  id: string,
  now: string,
  songIds: readonly string[] = [],
): Playlist {
  return {
    id,
    profileId,
    name: uniqueLookName(name, new Set(taken.map((p) => p.name.toLowerCase()))),
    lookId: null,
    entries: songIds.map((songId) => ({ songId, lookId: null })),
    shuffle: false,
    repeat: 'playlist',
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: null,
  }
}
