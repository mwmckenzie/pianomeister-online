// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { SongFacts } from './SongFacts'
import { updateManifest } from './updateManifest'

const facts = (bars: number): SongFacts => ({
  durationSeconds: bars * 2,
  durationTicks: bars * 1920,
  ppq: 480,
  bars,
  timeSignatures: ['4/4'],
  bpm: 120,
})

describe('updateManifest', () => {
  it('creates entries titled after the file name, sorted by file name', () => {
    const m = updateManifest(null, [
      { fileName: 'b-song.mid', id: 'bb', facts: facts(2) },
      { fileName: 'a song.midi', id: 'aa', facts: facts(1) },
    ])
    expect(m.version).toBe(1)
    expect(m.songs.map((s) => [s.fileName, s.title, s.composer, s.tags])).toEqual([
      ['a song.midi', 'a song', '', []],
      ['b-song.mid', 'b-song', '', []],
    ])
  })

  it('keeps hand edits and order, refreshes ids and facts, drops removed files, appends new ones', () => {
    const existing = {
      version: 1 as const,
      songs: [
        {
          id: 'old',
          fileName: 'z.mid',
          title: 'Zed',
          composer: 'Me',
          tags: ['x'],
          facts: facts(1),
        },
        {
          id: 'gone',
          fileName: 'gone.mid',
          title: 'Gone',
          composer: '',
          tags: [],
          facts: facts(1),
        },
        { id: 'a', fileName: 'a.mid', title: 'Ay', composer: '', tags: [], facts: facts(1) },
      ],
    }
    const m = updateManifest(existing, [
      { fileName: 'a.mid', id: 'a', facts: facts(1) },
      { fileName: 'new.mid', id: 'n', facts: facts(3) },
      { fileName: 'z.mid', id: 'new-hash', facts: facts(5) },
    ])
    expect(m.songs.map((s) => s.fileName)).toEqual(['z.mid', 'a.mid', 'new.mid'])
    expect(m.songs[0]).toEqual({
      id: 'new-hash',
      fileName: 'z.mid',
      title: 'Zed',
      composer: 'Me',
      tags: ['x'],
      facts: facts(5),
    })
  })

  it('is stable: updating an up-to-date manifest changes nothing', () => {
    const scanned = [{ fileName: 'a.mid', id: 'a', facts: facts(1) }]
    const once = updateManifest(null, scanned)
    expect(updateManifest(once, scanned)).toEqual(once)
  })
})
