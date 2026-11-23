// @vitest-environment node
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { makePracticeData } from '../testing/makePracticeData'
import { buildArchive } from './buildArchive'
import { planImport } from './planImport'
import { readArchive } from './readArchive'

const LOOKS = {
  format: 'pianomeister-look',
  version: 8,
  looks: [{ id: 'l1', name: 'Synth', createdAt: '2026-11-22T10:00:00.000Z', settings: {} }],
} as const

const override = { timeSignature: { numerator: 3, denominator: 4 }, barOneStartTick: 240 }

const archive = () =>
  buildArchive({
    uploads: [
      { songId: 'u1', fileName: 'song.mid', addedAt: 1000, bytes: new Uint8Array([1, 2, 3]) },
      { songId: 'u2', fileName: 'Song.mid', addedAt: 2000, bytes: new Uint8Array([4, 5]) },
    ],
    meta: new Map([
      ['u1', { title: 'Mine', tags: ['exam'] }],
      ['bundled', { composer: 'Bach' }],
    ]),
    overrides: new Map([['u1', override]]),
    practice: makePracticeData({ bookmarks: 2 }),
    looks: LOOKS,
    exportedAt: new Date('2026-11-16T10:00:00Z'),
  })

const zipWith = (json: unknown) => zipSync({ 'library.json': strToU8(JSON.stringify(json)) })

describe('library archive', () => {
  it('round-trips uploads, metadata and meter overrides', () => {
    const { document, uploads } = readArchive(archive())
    expect(document.version).toBe('1.3')
    expect(document.looks).toEqual(LOOKS)
    expect(document.exportedAt).toBe('2026-11-16T10:00:00.000Z')
    // Same file name twice (case-insensitively): the second gets a suffix.
    expect(document.uploads.map((u) => u.path)).toEqual(['uploads/song.mid', 'uploads/Song-2.mid'])
    expect(uploads).toEqual([
      { fileName: 'song.mid', addedAt: 1000, bytes: new Uint8Array([1, 2, 3]) },
      { fileName: 'Song.mid', addedAt: 2000, bytes: new Uint8Array([4, 5]) },
    ])
    expect(document.meta).toEqual({
      u1: { title: 'Mine', tags: ['exam'] },
      bundled: { composer: 'Bach' },
    })
    expect(document.meterOverrides).toEqual({ u1: override })
  })

  it('round-trips profiles, bookmarks, hand assignments, sessions and play records', () => {
    expect(readArchive(archive()).document.practice).toEqual(makePracticeData({ bookmarks: 2 }))
  })

  it('reads a 1.0 backup (no practice data) as having no profiles', () => {
    const practice = readArchive(
      zipWith({ format: 'pianomeister-library', version: '1.0', uploads: [], meta: {} }),
    ).document.practice
    expect(practice).toEqual({
      profiles: [],
      bookmarks: [],
      handAssignments: [],
      sessions: [],
      playRecords: [],
    })
  })

  it('drops malformed practice rows', () => {
    const good = makePracticeData({ bookmarks: 1 })
    const practice = readArchive(
      zipWith({
        format: 'pianomeister-library',
        version: '1.1',
        practice: {
          profiles: [...good.profiles, { id: 7 }],
          bookmarks: [
            ...good.bookmarks,
            { ...good.bookmarks[0], id: 'bad', config: { loop: { startBar: 9, endBar: 2 } } },
          ],
          handAssignments: [
            ...good.handAssignments,
            { profileId: 'default', songId: 'x', hands: { right: [99], left: [] } },
          ],
          sessions: [...good.sessions, { id: 's' }],
          playRecords: [...good.playRecords, { ...good.playRecords[0], playedMs: -5 }],
        },
      }),
    ).document.practice
    expect(practice).toEqual(good)
  })

  it('reads a 1.1 backup: complete passes count as plays; 1.2 keeps other setups and the full setup', () => {
    const good = makePracticeData({ bookmarks: 1 })
    const first = good.playRecords[0]
    const old = readArchive(
      zipWith({
        format: 'pianomeister-library',
        version: '1.1',
        practice: {
          ...good,
          playRecords: [{ ...first, plays: undefined, passes: 4, temporary: true }],
        },
      }),
    ).document.practice
    expect(old?.playRecords[0]).toMatchObject({ plays: 4, temporary: true })
    expect(old?.playRecords[0]).not.toHaveProperty('passes')

    const other = {
      ...good.playRecords[0],
      bookmarkId: null,
      plays: 2,
      loop: { startBar: 3, endBar: 9 },
      tempoPercent: 70,
      handAudio: { right: 'solo', left: 'on' },
      preRollBeats: 1,
      preRollMode: 'quiet',
      metronomeMode: 'always',
    }
    const current = readArchive(
      zipWith({
        format: 'pianomeister-library',
        version: '1.2',
        practice: { ...good, playRecords: [other] },
      }),
    ).document.practice
    expect(current?.playRecords).toEqual([other])
  })

  it('rejects files that are not library exports', () => {
    expect(() => readArchive(new Uint8Array([1, 2, 3]))).toThrow(/Not a zip/)
    expect(() => readArchive(zipSync({ 'x.txt': strToU8('hi') }))).toThrow(/no library.json/)
    expect(() => readArchive(zipWith({ format: 'other', version: '1.0' }))).toThrow(
      /Not a PianoMeister/,
    )
  })

  it('accepts newer minor versions and rejects other major versions', () => {
    expect(
      readArchive(zipWith({ format: 'pianomeister-library', version: '1.7' })).document.uploads,
    ).toEqual([])
    expect(() => readArchive(zipWith({ format: 'pianomeister-library', version: '2.0' }))).toThrow(
      /Unsupported library export version 2.0/,
    )
  })

  it('drops malformed entries instead of failing', () => {
    const { document, uploads } = readArchive(
      zipWith({
        format: 'pianomeister-library',
        version: '1.0',
        uploads: [
          { songId: 'x', fileName: 'x.mid', addedAt: 1, path: 'uploads/missing.mid' },
          'junk',
        ],
        meta: { a: { title: 5 }, b: { tags: ['ok'] } },
        meterOverrides: {
          a: { timeSignature: { numerator: 3, denominator: 5 }, barOneStartTick: 0 },
        },
      }),
    )
    expect(uploads).toEqual([])
    expect(document.meta).toEqual({ b: { tags: ['ok'] } })
    expect(document.meterOverrides).toEqual({})
  })
})

describe('planImport', () => {
  const { document } = readArchive(archive())

  it('applies everything to an empty library once the uploads are in', () => {
    const plan = planImport(document, {
      songIds: new Set(['u1', 'u2', 'bundled']),
      metaIds: new Set(),
      overrideIds: new Set(),
    })
    expect(plan.setMeta).toEqual([
      ['u1', { title: 'Mine', tags: ['exam'] }],
      ['bundled', { composer: 'Bach' }],
    ])
    expect(plan.setOverrides).toEqual([['u1', override]])
    expect(plan).toMatchObject({
      metaApplied: 2,
      metaKept: 0,
      overridesApplied: 1,
      unknownSongs: 0,
    })
  })

  it('keeps local edits and skips songs that are not in the library', () => {
    const plan = planImport(document, {
      songIds: new Set(['u1']),
      metaIds: new Set(['u1']),
      overrideIds: new Set(['u1']),
    })
    expect(plan.setMeta).toEqual([])
    expect(plan.setOverrides).toEqual([])
    expect(plan).toMatchObject({ metaKept: 1, overridesKept: 1, unknownSongs: 1 })
  })
})
