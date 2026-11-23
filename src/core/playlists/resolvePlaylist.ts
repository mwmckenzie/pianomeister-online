import type { Playlist } from './Playlist'
import type { ResolvedPlaylist } from './ResolvedPlaylist'

/**
 * Resolves a playlist's references (milestone 9.5): a song not in `songs` is missing (its entry
 * stays, listening skips it); a look not in `lookIds` falls back to Current look (null), flagged.
 */
export function resolvePlaylist(
  playlist: Playlist,
  songs: ReadonlyMap<string, { readonly durationSec: number }>,
  lookIds: ReadonlySet<string>,
): ResolvedPlaylist {
  const check = (id: string | null) =>
    id === null
      ? { id: null, missing: false }
      : lookIds.has(id)
        ? { id, missing: false }
        : { id: null, missing: true }
  const own = check(playlist.lookId)
  let durationSec = 0
  const entries = playlist.entries.map((e) => {
    const song = songs.get(e.songId)
    const override = check(e.lookId)
    if (song !== undefined) durationSec += song.durationSec
    return {
      songId: e.songId,
      missing: song === undefined,
      override: override.id,
      overrideMissing: override.missing,
      lookId: override.id ?? own.id,
      durationSec: song?.durationSec ?? 0,
    }
  })
  return { lookId: own.id, lookMissing: own.missing, entries, durationSec }
}
