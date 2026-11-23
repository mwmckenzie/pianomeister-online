import type { Playlist } from './Playlist'
import type { PlaylistEntry } from './PlaylistEntry'
import type { PlaylistRepeat } from './PlaylistRepeat'

/** Longest playlist name kept. */
export const MAX_PLAYLIST_NAME = 60
const REPEATS: readonly PlaylistRepeat[] = ['playlist', 'one', 'off']

/**
 * A stored, backed-up or imported playlist made valid, or null when it can't be one (no id,
 * owner or name). Bad entries are dropped; a bad look id, shuffle or repeat takes its default.
 */
export function readPlaylist(raw: unknown, now = new Date().toISOString()): Playlist | null {
  if (!isRecord(raw)) return null
  const { id, profileId } = raw
  if (typeof id !== 'string' || id === '' || typeof profileId !== 'string') return null
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_PLAYLIST_NAME) : ''
  if (name === '') return null
  const entries: PlaylistEntry[] = []
  for (const e of Array.isArray(raw.entries) ? raw.entries : []) {
    if (!isRecord(e) || typeof e.songId !== 'string' || e.songId === '') continue
    entries.push({ songId: e.songId, lookId: typeof e.lookId === 'string' ? e.lookId : null })
  }
  const repeat = REPEATS.find((r) => r === raw.repeat) ?? 'playlist'
  return {
    id,
    profileId,
    name,
    lookId: typeof raw.lookId === 'string' ? raw.lookId : null,
    entries,
    shuffle: raw.shuffle === true,
    repeat,
    createdAt: isDate(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isDate(raw.updatedAt) ? raw.updatedAt : now,
    lastPlayedAt: typeof raw.lastPlayedAt === 'number' ? raw.lastPlayedAt : null,
  }
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
