// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { captureLook } from '../looks/lookValues'
import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { withSetting } from '../settings/settingValues'
import { mergePlaylists } from './mergePlaylists'
import type { Playlist } from './Playlist'
import { readPlaylist } from './readPlaylist'
import { readPlaylistFile } from './readPlaylistFile'
import { resolvePlaylist } from './resolvePlaylist'
import { toPlaylistFile } from './toPlaylistFile'

const NOW = '2026-11-24T10:00:00.000Z'

function ids(): () => string {
  let n = 0
  return () => `new-${++n}`
}

const playlist = (over: Partial<Playlist> = {}): Playlist => ({
  id: 'p1',
  profileId: 'me',
  name: 'Evening wind-down',
  lookId: 'builtin:aurora',
  entries: [
    { songId: 'minuet', lookId: null },
    { songId: 'canon', lookId: 'builtin:mist' },
  ],
  shuffle: false,
  repeat: 'playlist',
  createdAt: NOW,
  updatedAt: NOW,
  lastPlayedAt: null,
  ...over,
})

describe('readPlaylist', () => {
  it('keeps a valid playlist as it is', () => {
    expect(readPlaylist(playlist())).toEqual(playlist())
  })

  it('drops bad entries and defaults bad fields; refuses one without id, owner or name', () => {
    const read = readPlaylist({
      ...playlist(),
      entries: [{ songId: '' }, { songId: 'x', lookId: 3 }, 'junk'],
      repeat: 'sometimes',
      shuffle: 'yes',
    })
    expect(read?.entries).toEqual([{ songId: 'x', lookId: null }])
    expect(read?.repeat).toBe('playlist')
    expect(read?.shuffle).toBe(false)
    expect(readPlaylist({ ...playlist(), name: '  ' })).toBeNull()
    expect(readPlaylist({ ...playlist(), id: '' })).toBeNull()
    expect(readPlaylist(null)).toBeNull()
  })
})

describe('mergePlaylists', () => {
  it('skips an identical one, gives a changed one a new id, renames a clash, never overwrites', () => {
    const mine = playlist()
    const changed = playlist({ entries: [{ songId: 'canon', lookId: null }] })
    const sameName = playlist({ id: 'p2' })
    const { added, skipped } = mergePlaylists([mine, changed, sameName], [mine], 'me', ids())
    expect(skipped).toBe(1)
    expect(added.map((p) => [p.id, p.name])).toEqual([
      ['new-1', 'Evening wind-down (2)'],
      ['p2', 'Evening wind-down (3)'],
    ])
  })

  it('gives every added playlist to the importing profile', () => {
    const { added } = mergePlaylists([playlist({ profileId: 'other' })], [], 'me', ids())
    expect(added[0]?.profileId).toBe('me')
  })
})

describe('playlist files', () => {
  const saved = captureLook(withSetting(DEFAULT_SETTINGS, 'lines.nowGlow', 2), 'look-a', 'Mine')
  const withSaved = playlist({ lookId: 'look-a' })

  it('exports the saved looks the playlists use, not built-ins', () => {
    const file = toPlaylistFile([withSaved], [saved])
    expect(file.format).toBe('pianomeister-playlist')
    expect(file.looks?.looks.map((l) => l.id)).toEqual(['look-a'])
    expect(toPlaylistFile([playlist()], [saved]).looks).toBeUndefined()
  })

  it('round-trips: songs matched by id, a missing song kept and counted, looks imported', () => {
    const file = JSON.parse(JSON.stringify(toPlaylistFile([withSaved], [saved])))
    const result = readPlaylistFile(file, {
      profileId: 'other',
      playlists: [],
      songIds: new Set(['minuet']),
      savedLooks: [],
      importLooks: true,
      newId: ids(),
      now: NOW,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.missingSongs).toBe(1)
    expect(result.lookCount).toBe(1)
    expect(result.looks.map((l) => l.id)).toEqual(['look-a'])
    const [p] = result.playlists
    expect(p?.profileId).toBe('other')
    expect(p?.lookId).toBe('look-a')
    // The missing song's entry stays; its built-in look resolves.
    expect(p?.entries).toEqual([
      { songId: 'minuet', lookId: null },
      { songId: 'canon', lookId: 'builtin:mist' },
    ])
  })

  it('without "Import its looks too", a saved look it lacks falls back to Current look', () => {
    const file = JSON.parse(JSON.stringify(toPlaylistFile([withSaved], [saved])))
    const result = readPlaylistFile(file, {
      profileId: 'me',
      playlists: [],
      songIds: new Set(),
      savedLooks: [],
      importLooks: false,
      newId: ids(),
      now: NOW,
    })
    expect(result.ok && result.looks).toEqual([])
    expect(result.ok && result.playlists[0]?.lookId).toBeNull()
  })

  it('follows a look whose id was taken: the references move with it', () => {
    const other = captureLook(DEFAULT_SETTINGS, 'look-a', 'Someone else')
    const file = JSON.parse(JSON.stringify(toPlaylistFile([withSaved], [saved])))
    const result = readPlaylistFile(file, {
      profileId: 'me',
      playlists: [],
      songIds: new Set(),
      savedLooks: [other],
      importLooks: true,
      newId: ids(),
      now: NOW,
    })
    expect(result.ok && result.looks.map((l) => l.id)).toEqual(['new-1'])
    expect(result.ok && result.playlists[0]?.lookId).toBe('new-1')
  })

  it('refuses what is not a playlist file, a newer version, or one with no playlist', () => {
    const target = {
      profileId: 'me',
      playlists: [],
      songIds: new Set<string>(),
      savedLooks: [],
      importLooks: true,
      newId: ids(),
    }
    expect(readPlaylistFile({ format: 'pianomeister-look' }, target)).toEqual({
      ok: false,
      error: 'notPlaylistFile',
    })
    expect(
      readPlaylistFile({ format: 'pianomeister-playlist', version: 99, playlists: [] }, target),
    ).toEqual({ ok: false, error: 'newer' })
    expect(
      readPlaylistFile({ format: 'pianomeister-playlist', version: 1, playlists: [] }, target),
    ).toEqual({ ok: false, error: 'empty' })
  })
})

describe('resolvePlaylist', () => {
  it('marks missing songs and looks, and sums the songs that exist', () => {
    const resolved = resolvePlaylist(
      playlist({ lookId: 'gone' }),
      new Map([['minuet', { durationSec: 91 }]]),
      new Set(['builtin:mist']),
    )
    expect(resolved.lookId).toBeNull()
    expect(resolved.lookMissing).toBe(true)
    expect(resolved.durationSec).toBe(91)
    expect(resolved.entries.map((e) => [e.missing, e.lookId])).toEqual([
      [false, null],
      [true, 'builtin:mist'],
    ])
  })
})
