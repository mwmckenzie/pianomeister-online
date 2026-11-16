// @vitest-environment node
import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { SongManifest } from '@/core/library/SongManifest'
import { readFixture } from '@/core/testing/readFixture'

import type { BundledSongs } from './BundledSongs'
import { Library } from './Library'
import { PianoMeisterDb } from './PianoMeisterDb'
import type { UploadFile } from './UploadFile'

const songsDir = new URL('../../public/songs/', import.meta.url)
const bundled: BundledSongs = {
  manifest: async () =>
    JSON.parse(readFileSync(new URL('manifest.json', songsDir), 'utf8')) as SongManifest,
  bytes: async (fileName) => new Uint8Array(readFileSync(new URL(fileName, songsDir))),
}

const file = (name: string, bytes: Uint8Array): UploadFile => ({
  name,
  size: bytes.byteLength,
  arrayBuffer: async () => bytes.slice().buffer,
})
const pedalDemo = () => file('pedal-demo.mid', readFixture('pedal-demo.mid'))

let db: PianoMeisterDb
let library: Library
let persistenceRequests: number
let dbCount = 0

beforeEach(() => {
  db = new PianoMeisterDb(`test-${dbCount++}`)
  persistenceRequests = 0
  library = new Library(db, bundled, {
    requestPersistence: async () => {
      persistenceRequests++
      return true
    },
  })
})

afterEach(async () => {
  await db.delete()
})

async function uploadPedalDemo(): Promise<string> {
  const [result] = await library.upload([pedalDemo()])
  if (result?.outcome !== 'added') throw new Error('upload failed')
  return result.songId
}

describe('Library', () => {
  it('lists the bundled songs from the manifest', async () => {
    const entries = await library.entries()
    expect(entries.map((e) => [e.title, e.source])).toEqual([
      ['Minuet in G', 'bundled'],
      ['Canon in D', 'bundled'],
      ['Invention No. 1 in C major, BWV 772', 'bundled'],
    ])
  })

  it('uploads a MIDI file and lists it after the bundled songs', async () => {
    const [result] = await library.upload([pedalDemo()])
    expect(result).toMatchObject({
      outcome: 'added',
      fileName: 'pedal-demo.mid',
      title: 'Pedal demo',
    })
    const entries = await library.entries()
    expect(entries[3]).toMatchObject({
      source: 'uploaded',
      fileName: 'pedal-demo.mid',
      title: 'Pedal demo',
      bars: 8,
      timeSignature: '4/4',
    })
    expect(entries[3]?.addedAt).toBeGreaterThan(0)
    expect(persistenceRequests).toBe(1)
  })

  it('reports duplicates (of bundled songs, uploads, and within a batch) and rejections', async () => {
    const results = await library.upload([
      pedalDemo(),
      file('copy.mid', readFixture('pedal-demo.mid')),
      file('minuet copy.MID', readFixture('minuet-in-g.mid')),
      file('notes.txt', new Uint8Array([1])),
      file('bad.mid', new Uint8Array([1, 2, 3, 4])),
    ])
    expect(results.map((r) => r.outcome)).toEqual([
      'added',
      'duplicate',
      'duplicate',
      'rejected',
      'rejected',
    ])
    expect(results[1]).toMatchObject({ title: 'Pedal demo' })
    expect(results[2]).toMatchObject({ title: 'Minuet in G' })
    expect(results[3]).toMatchObject({ reason: expect.stringMatching(/not a MIDI file/) })
    expect(results[4]).toMatchObject({ reason: 'not a readable MIDI file' })
    expect(await library.upload([pedalDemo()])).toMatchObject([{ outcome: 'duplicate' }])
    expect(persistenceRequests).toBe(1)
  })

  it('stores only changed metadata fields, and resets to the original', async () => {
    const minuet = (await library.entries())[0]
    if (minuet === undefined) throw new Error('no songs')
    await library.setMeta(minuet.songId, {
      title: 'My Minuet',
      composer: minuet.composer,
      tags: [' baroque ', 'Exam', 'exam'],
    })
    expect(await library.entry(minuet.songId)).toMatchObject({
      title: 'My Minuet',
      composer: 'Christian Petzold (attrib. J.S. Bach)',
      tags: ['baroque', 'Exam'],
      edited: true,
    })
    expect((await db.songMeta.get(minuet.songId))?.edit).toEqual({
      title: 'My Minuet',
      tags: ['baroque', 'Exam'],
    })
    await library.setMeta(minuet.songId, { ...minuet.original })
    expect(await db.songMeta.get(minuet.songId)).toBeUndefined()
    await library.setMeta(minuet.songId, { ...minuet.original, title: 'X' })
    await library.resetMeta(minuet.songId)
    expect(await library.entry(minuet.songId)).toMatchObject({
      title: 'Minuet in G',
      edited: false,
    })
  })

  it('opens songs with default or stored hands and the meter override', async () => {
    const id = await uploadPedalDemo()
    let opened = await library.openSong(id)
    expect(opened.song.notes.length).toBe(72)
    expect(opened.hands).toEqual({ right: [0], left: [1] })
    expect(opened.defaultHands).toBe(true)
    expect(opened.override).toBeNull()

    const override = { timeSignature: { numerator: 3, denominator: 4 }, barOneStartTick: 0 }
    await library.setHands(id, { right: [0], left: [] })
    await library.setOverride(id, override)
    opened = await library.openSong(id)
    expect(opened.hands).toEqual({ right: [0], left: [] })
    expect(opened.defaultHands).toBe(false)
    expect(opened.override).toEqual(override)
    expect(opened.entry.bars).toBe(11)

    await library.resetHands(id)
    await library.clearOverride(id)
    opened = await library.openSong(id)
    expect(opened.defaultHands).toBe(true)
    expect(opened.override).toBeNull()

    const bundledSong = await library.openSong((await library.entries())[1]?.songId ?? '')
    expect(bundledSong.entry.title).toBe('Canon in D')
    expect(bundledSong.song.notes.length).toBe(1589)
  })

  it('deletes an upload with its metadata, override, hands and last-song pointer', async () => {
    const id = await uploadPedalDemo()
    await library.setMeta(id, { title: 'Pedal', composer: '', tags: [] })
    await library.setOverride(id, {
      timeSignature: { numerator: 3, denominator: 4 },
      barOneStartTick: 0,
    })
    await library.setHands(id, { right: [1], left: [0] })
    await library.setLastSongId(id)
    expect(await library.startSongId()).toBe(id)

    await library.deleteUpload(id)
    expect(await library.entry(id)).toBeNull()
    expect(await db.songMeta.count()).toBe(0)
    expect(await db.meterOverrides.count()).toBe(0)
    expect(await db.handAssignments.count()).toBe(0)
    expect(await library.startSongId()).toBe((await library.entries())[0]?.songId)
  })

  it('starts with the first bundled song, then the last opened one', async () => {
    const entries = await library.entries()
    expect(await library.startSongId()).toBe(entries[0]?.songId)
    await library.setLastSongId(entries[2]?.songId ?? '')
    expect(await library.startSongId()).toBe(entries[2]?.songId)
    await library.setLastSongId('no-such-song')
    expect(await library.startSongId()).toBe(entries[0]?.songId)
  })

  it('exports and re-imports uploads with metadata and overrides', async () => {
    const id = await uploadPedalDemo()
    const minuetId = (await library.entries())[0]?.songId ?? ''
    const override = { timeSignature: { numerator: 3, denominator: 4 }, barOneStartTick: 0 }
    await library.setMeta(id, { title: 'Pedal study', composer: 'Me', tags: ['exam'] })
    await library.setMeta(minuetId, { title: 'Minuet', composer: '', tags: [] })
    await library.setOverride(id, override)
    const addedAt = (await library.entry(id))?.addedAt
    const zip = await library.exportArchive()

    await library.deleteUpload(id)
    await library.resetMeta(minuetId)
    const report = await library.importArchive(zip)
    expect(report.uploads).toMatchObject([{ outcome: 'added', songId: id }])
    expect(report).toMatchObject({ metaApplied: 2, metaKept: 0, overridesApplied: 1 })
    expect(await library.entry(id)).toMatchObject({
      title: 'Pedal study',
      composer: 'Me',
      tags: ['exam'],
      override,
      addedAt,
    })
    expect((await library.entry(minuetId))?.title).toBe('Minuet')

    // Again: everything is already there, so local edits win.
    await library.setMeta(id, { title: 'Changed locally', composer: 'Me', tags: ['exam'] })
    const again = await library.importArchive(zip)
    expect(again.uploads).toMatchObject([{ outcome: 'duplicate' }])
    expect(again).toMatchObject({ metaApplied: 0, metaKept: 2, overridesKept: 1 })
    expect((await library.entry(id))?.title).toBe('Changed locally')
  })

  it('rejects an archive that is not a library export', async () => {
    await expect(library.importArchive(new Uint8Array([1, 2, 3]))).rejects.toThrow(/Not a zip/)
  })
})
