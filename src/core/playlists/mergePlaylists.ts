import { uniqueLookName } from '../looks/uniqueLookName'
import type { Playlist } from './Playlist'
import { samePlaylist } from './samePlaylist'

/**
 * Adds incoming playlists beside the existing ones without ever overwriting one (milestone 9.5,
 * the looks' rules): one identical to a local playlist with the same id is skipped; a taken id
 * (by any profile) gets a new one; a name the profile already uses becomes "Name (2)". Every
 * added playlist belongs to `profileId`.
 */
export function mergePlaylists(
  incoming: readonly Playlist[],
  existing: readonly Playlist[],
  profileId: string,
  newId: () => string,
): { readonly added: readonly Playlist[]; readonly skipped: number } {
  const byId = new Map(existing.map((p) => [p.id, p]))
  const ids = new Set(existing.map((p) => p.id))
  const names = new Set(
    existing.filter((p) => p.profileId === profileId).map((p) => p.name.toLowerCase()),
  )
  const added: Playlist[] = []
  let skipped = 0
  for (const playlist of incoming) {
    const mine = byId.get(playlist.id)
    if (mine !== undefined && samePlaylist(mine, playlist)) {
      skipped++
      continue
    }
    const id = ids.has(playlist.id) ? newId() : playlist.id
    const name = uniqueLookName(playlist.name, names)
    ids.add(id)
    names.add(name.toLowerCase())
    added.push({ ...playlist, id, name, profileId })
  }
  return { added, skipped }
}
