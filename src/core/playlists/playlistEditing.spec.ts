// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { moveEntry } from './moveEntry'
import { newPlaylist } from './newPlaylist'
import { recentPlaylists } from './recentPlaylists'

describe('newPlaylist', () => {
  it('names it uniquely and holds the given songs with no looks', () => {
    const first = newPlaylist('p', 'New playlist', [], 'a', '2026-11-24T00:00:00.000Z')
    const second = newPlaylist('p', 'New playlist', [first], 'b', '2026-11-24T00:00:00.000Z', [
      's1',
    ])
    expect(first.name).toBe('New playlist')
    expect(second.name).toBe('New playlist (2)')
    expect(second.entries).toEqual([{ songId: 's1', lookId: null }])
    expect(second).toMatchObject({ lookId: null, shuffle: false, repeat: 'playlist' })
  })
})

describe('moveEntry', () => {
  it('moves one item, clamping the target', () => {
    expect(moveEntry(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveEntry(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveEntry(['a', 'b', 'c'], 1, 9)).toEqual(['a', 'c', 'b'])
  })

  it('returns the same array when nothing moves', () => {
    const items = ['a', 'b']
    expect(moveEntry(items, 0, -1)).toBe(items)
    expect(moveEntry(items, 5, 0)).toBe(items)
  })
})

describe('recentPlaylists', () => {
  const at = (id: string, created: string, played: number | null) => ({
    ...newPlaylist('p', id, [], id, created),
    lastPlayedAt: played,
  })

  it('puts the recently played first, then the newest, at most three', () => {
    const list = [
      at('old', '2026-01-01T00:00:00.000Z', null),
      at('new', '2026-03-01T00:00:00.000Z', null),
      at('played', '2026-01-02T00:00:00.000Z', 5),
      at('playedLater', '2026-01-03T00:00:00.000Z', 9),
    ]
    expect(recentPlaylists(list).map((p) => p.id)).toEqual(['playedLater', 'played', 'new'])
  })
})
