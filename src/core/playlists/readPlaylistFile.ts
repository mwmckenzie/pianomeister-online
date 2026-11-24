import { EMPTY_COLOUR_SETS } from '../color/EMPTY_COLOUR_SETS'
import type { NoteColourSets } from '../color/NoteColourSets'
import { BUILT_IN_LOOKS } from '../looks/BUILT_IN_LOOKS'
import type { Look } from '../looks/Look'
import { readLookFile } from '../looks/readLookFile'
import { mergePlaylists } from './mergePlaylists'
import type { Playlist } from './Playlist'
import type { PlaylistFileResult } from './PlaylistFileResult'
import { readPlaylist } from './readPlaylist'
import { PLAYLIST_FILE_VERSION } from './toPlaylistFile'

/** Where an imported playlist lands, and what it can refer to. */
export interface PlaylistImportTarget {
  readonly profileId: string
  /** Every stored playlist (ids are unique across profiles). */
  readonly playlists: readonly Playlist[]
  /** Song ids in this library (the content hash, the identity backups use). */
  readonly songIds: ReadonlySet<string>
  readonly savedLooks: readonly Look[]
  readonly colourSets?: NoteColourSets
  /** "Import its looks too" (default on). */
  readonly importLooks: boolean
  readonly newId: () => string
  readonly now?: string
}

/**
 * Reads a `.pmplaylist.json` file (Import, drop; milestone 9.5). Playlists merge like looks
 * (mergePlaylists). Songs are matched by song id; songs this library doesn't have stay as
 * "Missing song" entries and are counted. Look references: a built-in id always resolves; a saved
 * look this device has is kept; one the file carries is imported with it when `importLooks` (its
 * id may change, and the references follow); anything else falls back to "Current look" (null).
 * Import never plays anything.
 */
export function readPlaylistFile(raw: unknown, target: PlaylistImportTarget): PlaylistFileResult {
  if (!isRecord(raw) || raw.format !== 'pianomeister-playlist' || !Array.isArray(raw.playlists)) {
    return { ok: false, error: 'notPlaylistFile' }
  }
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'notPlaylistFile' }
  }
  if (version > PLAYLIST_FILE_VERSION) return { ok: false, error: 'newer' }
  const now = target.now ?? new Date().toISOString()

  // The file's looks: imported (ids may change) or only counted.
  const carried = isRecord(raw.looks) ? raw.looks : null
  const lookRead =
    carried === null
      ? null
      : readLookFile(carried, target.savedLooks, target.newId, now, true, {
          sets: target.colourSets ?? EMPTY_COLOUR_SETS,
        })
  const lookCount = lookRead?.ok === true ? lookRead.looks.length + lookRead.skipped : 0
  const lookIds = new Map<string, string>()
  const imported: Look[] = []
  if (lookRead?.ok === true && target.importLooks) {
    for (const [from, to] of lookRead.idMap) lookIds.set(from, to)
    imported.push(...lookRead.looks)
  }
  const known = new Set([...BUILT_IN_LOOKS, ...target.savedLooks].map((l) => l.id))
  const resolve = (id: string | null): string | null => {
    if (id === null) return null
    const mapped = lookIds.get(id)
    if (mapped !== undefined) return mapped
    return known.has(id) ? id : null
  }

  const incoming: Playlist[] = []
  for (const entry of raw.playlists) {
    if (!isRecord(entry)) continue
    const playlist = readPlaylist(
      { ...entry, profileId: target.profileId, updatedAt: now, lastPlayedAt: null },
      now,
    )
    if (playlist === null) continue
    incoming.push({
      ...playlist,
      lookId: resolve(playlist.lookId),
      entries: playlist.entries.map((e) => ({ ...e, lookId: resolve(e.lookId) })),
    })
  }
  if (incoming.length === 0) return { ok: false, error: 'empty' }
  const { added } = mergePlaylists(incoming, target.playlists, target.profileId, target.newId)
  const missing = new Set<string>()
  for (const p of added)
    for (const e of p.entries) if (!target.songIds.has(e.songId)) missing.add(e.songId)
  return { ok: true, playlists: added, looks: imported, missingSongs: missing.size, lookCount }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
