// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildEntries } from './buildEntries'
import type { SongFacts } from './SongFacts'

const facts: SongFacts = {
  durationSeconds: 8,
  durationTicks: 7680,
  ppq: 480,
  bars: 4,
  timeSignatures: ['4/4', '3/4'],
  bpm: 120,
}

const manifest = {
  version: 1 as const,
  songs: [
    { id: 'b1', fileName: 'b1.mid', title: 'Bundled', composer: 'Bach', tags: ['baroque'], facts },
  ],
}
const uploads = [{ songId: 'u1', fileName: 'mine.mid', title: 'mine', addedAt: 1000, facts }]

describe('buildEntries', () => {
  it('lists bundled songs, then uploads, with their originals', () => {
    const [bundled, upload] = buildEntries(manifest, uploads, new Map(), new Map())
    expect(bundled).toMatchObject({
      songId: 'b1',
      source: 'bundled',
      title: 'Bundled',
      composer: 'Bach',
      tags: ['baroque'],
      edited: false,
      bars: 4,
      timeSignature: '4/4 → 3/4',
      addedAt: null,
      override: null,
    })
    expect(upload).toMatchObject({
      songId: 'u1',
      source: 'uploaded',
      title: 'mine',
      composer: '',
      tags: [],
      addedAt: 1000,
    })
  })

  it('applies metadata edits and meter overrides', () => {
    const override = { timeSignature: { numerator: 3, denominator: 4 }, barOneStartTick: 0 }
    const [bundled] = buildEntries(
      manifest,
      [],
      new Map([['b1', { title: 'Renamed' }]]),
      new Map([['b1', override]]),
    )
    expect(bundled).toMatchObject({
      title: 'Renamed',
      composer: 'Bach',
      original: { title: 'Bundled' },
      edited: true,
      override,
      bars: 6,
      timeSignature: '3/4',
    })
  })
})
