import type { Look } from '../looks/Look'
import { toLookFile } from '../looks/toLookFile'
import type { Playlist } from './Playlist'
import type { PlaylistFile } from './PlaylistFile'

/** The playlist file format's version. */
export const PLAYLIST_FILE_VERSION = 1

/**
 * `.pmplaylist.json` for these playlists (Export, Export all), carrying the saved looks they
 * refer to (the playlists' and their songs'); built-in looks resolve by id on any device.
 */
export function toPlaylistFile(
  playlists: readonly Playlist[],
  savedLooks: readonly Look[],
): PlaylistFile {
  const used = new Set<string>()
  for (const p of playlists) {
    if (p.lookId !== null) used.add(p.lookId)
    for (const e of p.entries) if (e.lookId !== null) used.add(e.lookId)
  }
  const looks = savedLooks.filter((l) => !l.builtIn && used.has(l.id))
  return {
    format: 'pianomeister-playlist',
    version: PLAYLIST_FILE_VERSION,
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      lookId: p.lookId,
      entries: p.entries.map((e) => ({ songId: e.songId, lookId: e.lookId })),
      shuffle: p.shuffle,
      repeat: p.repeat,
      createdAt: p.createdAt,
    })),
    ...(looks.length > 0 ? { looks: toLookFile(looks) } : {}),
  }
}
