// @vitest-environment node
import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { SongManifest } from '@/core/library/SongManifest'
import { captureLook } from '@/core/looks/lookValues'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import { restoreValues } from '@/core/settings/settingGroups'
import { buildSmf, ev } from '@/core/testing/buildSmf'
import { readFixture } from '@/core/testing/readFixture'

import type { BundledSongs } from './BundledSongs'
import { Library } from './Library'
import { makeBookmark, makePracticeData, makeRecord } from '@/core/testing/makePracticeData'

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

  it("guesses a new upload's title and composer, in the library's spelling", async () => {
    const bytes = buildSmf({
      format: 1,
      ppq: 480,
      tracks: [[ev.trackName(0, 'Piano'), ev.noteOn(0, 0, 60), ev.noteOff(480, 0, 60)]],
    })
    const [result] = await library.upload([file('Bach_Invention_No.8_bwv_779_TwoHands.mid', bytes)])
    if (result?.outcome !== 'added') throw new Error('upload failed')
    expect(await library.entry(result.songId)).toMatchObject({
      title: 'Invention No. 8 BWV 779',
      composer: 'J.S. Bach',
      original: { title: 'Invention No. 8 BWV 779', composer: 'J.S. Bach' },
      edited: false,
    })
    // "Guess from file" guesses afresh and saves nothing.
    await library.setMeta(result.songId, { title: 'Mine', composer: '', tags: [] })
    expect(await library.guessMeta(result.songId)).toEqual({
      title: 'Invention No. 8 BWV 779',
      composer: 'J.S. Bach',
    })
    expect((await library.entry(result.songId))?.title).toBe('Mine')
    // Bundled songs have no file to guess from here.
    expect(await library.guessMeta((await library.entries())[0]?.songId ?? '')).toBeNull()
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

  it('opens songs with their meter override', async () => {
    const id = await uploadPedalDemo()
    let opened = await library.openSong(id)
    expect(opened.song.notes.length).toBe(72)
    expect(opened.override).toBeNull()

    const override = { timeSignature: { numerator: 3, denominator: 4 }, barOneStartTick: 0 }
    await library.setOverride(id, override)
    opened = await library.openSong(id)
    expect(opened.override).toEqual(override)
    expect(opened.entry.bars).toBe(11)

    await library.clearOverride(id)
    opened = await library.openSong(id)
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
    await db.handAssignments.put({
      profileId: 'default',
      songId: id,
      hands: { right: [1], left: [0] },
    })
    await library.setLastOpened(id, 'b1')
    expect(await library.startEntry()).toEqual({ songId: id, bookmarkId: 'b1' })
    await db.bookmarks.put(makeBookmark({ id: 'b1', profileId: 'default', songId: id }))
    await db.playRecords.put(makeRecord({ id: 'r1', profileId: 'default', songId: id }))

    await library.deleteUpload(id)
    expect(await library.entry(id)).toBeNull()
    expect(await db.songMeta.count()).toBe(0)
    expect(await db.meterOverrides.count()).toBe(0)
    expect(await db.handAssignments.count()).toBe(0)
    expect(await library.startEntry()).toEqual({
      songId: (await library.entries())[0]?.songId,
      bookmarkId: null,
    })
    // Bookmarks and stats are kept by default (decision 74).
    expect(await db.bookmarks.count()).toBe(1)
    expect(await db.playRecords.count()).toBe(1)
  })

  it('deletes an upload with its bookmarks and stats when asked to', async () => {
    const id = await uploadPedalDemo()
    await db.bookmarks.put(makeBookmark({ id: 'b1', profileId: 'default', songId: id }))
    await db.bookmarks.put(makeBookmark({ id: 'b2', profileId: 'default', songId: 'other' }))
    await db.playRecords.put(makeRecord({ id: 'r1', profileId: 'p2', songId: id }))
    await library.deleteUpload(id, { withPracticeData: true })
    expect((await db.bookmarks.toArray()).map((b) => b.id)).toEqual(['b2'])
    expect(await db.playRecords.count()).toBe(0)
  })

  it('starts with the first bundled song, then the profile last opened one', async () => {
    const entries = await library.entries()
    expect(await library.startEntry()).toEqual({ songId: entries[0]?.songId, bookmarkId: null })
    await library.setLastOpened(entries[2]?.songId ?? '', null)
    expect((await library.startEntry()).songId).toBe(entries[2]?.songId)
    // Another profile has its own.
    library.setProfile('p2')
    expect((await library.startEntry()).songId).toBe(entries[0]?.songId)
    await library.setLastOpened(entries[1]?.songId ?? '', 'b9')
    library.setProfile('default')
    expect((await library.startEntry()).songId).toBe(entries[2]?.songId)
    await library.setLastOpened('no-such-song', null)
    expect((await library.startEntry()).songId).toBe(entries[0]?.songId)
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
    const report = await library.applyImport(await library.prepareImport(zip), new Map())
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
    const again = await library.applyImport(await library.prepareImport(zip), new Map())
    expect(again.uploads).toMatchObject([{ outcome: 'duplicate' }])
    expect(again).toMatchObject({ metaApplied: 0, metaKept: 2, overridesKept: 1 })
    expect((await library.entry(id))?.title).toBe('Changed locally')
  })

  it('backs up saved looks: identical ones are skipped, changed ones added, nothing overwritten', async () => {
    const look = captureLook(DEFAULT_SETTINGS, 'look-a', 'Synth', '2026-11-22T10:00:00.000Z')
    await db.looks.put(look)
    const zip = await library.exportArchive()
    // Restoring onto the same device: the look is already here.
    const same = await library.applyImport(await library.prepareImport(zip), new Map())
    expect(same.looksAdded).toBe(0)
    // Changed here since the backup: the backup's version comes back beside it.
    await db.looks.put({ ...look, values: { ...look.values, 'lines.nowGlow': 2 } })
    const changed = await library.applyImport(
      await library.prepareImport(zip),
      new Map(),
      () => 'new-id',
    )
    expect(changed.looksAdded).toBe(1)
    const looks = await db.looks.orderBy('createdAt').toArray()
    expect(looks.map((l) => [l.id, l.name])).toEqual([
      ['look-a', 'Synth'],
      ['new-id', 'Synth (2)'],
    ])
    expect(looks[0]?.values['lines.nowGlow']).toBe(2)
  })

  it('backs up colour sets: nothing local is overwritten and looks follow a set that moved', async () => {
    const twelve = (hex: string) => Array.from({ length: 12 }, () => hex)
    const sets = {
      overrides: { warm: { 0: '#000001' } },
      custom: [{ id: 'custom-a' as const, name: 'Recital', colours: twelve('#111111') }],
    }
    const look = captureLook(
      restoreValues(DEFAULT_SETTINGS, new Map([['notes.palette', 'custom-a']])),
      'look-a',
      'Mine',
      '2026-11-22T10:00:00.000Z',
    )
    await db.looks.put(look)
    const zip = await library.exportArchive(new Date(), sets)
    const run = async (local: typeof sets) =>
      library.applyImport(await library.prepareImport(zip), new Map(), () => 'new', local)

    // Same device: nothing to add.
    const same = await run(sets)
    expect(same.colourSets).toMatchObject({ added: [], overrides: {} })
    expect(same.looksAdded).toBe(0)

    // The set was edited here since: the backup's comes back beside it, and so does its look.
    const edited = await run({
      overrides: { warm: { 0: '#000002' } },
      custom: [{ ...sets.custom[0]!, colours: twelve('#222222') }],
    })
    expect(edited.colourSets).toMatchObject({
      added: [{ id: 'custom-new', name: 'Recital 2', colours: twelve('#111111') }],
      overrides: {},
    })
    const looks = await db.looks.toArray()
    expect(looks.map((l) => l.values['notes.palette'])).toEqual(['custom-a', 'custom-new'])

    // A fresh device takes everything, and the look carries its own copy.
    await db.looks.clear()
    const fresh = await run({ overrides: {} as typeof sets.overrides, custom: [] })
    expect(fresh.colourSets).toMatchObject({ added: sets.custom, overrides: sets.overrides })
    expect((await db.looks.get('look-a'))?.values['notes.paletteSaved']).toEqual({
      name: 'Recital',
      colours: twelve('#111111'),
    })
  })

  it('rejects an archive that is not a library export', async () => {
    await expect(library.prepareImport(new Uint8Array([1, 2, 3]))).rejects.toThrow(/Not a zip/)
  })

  describe('backups with profiles', () => {
    let next = 0
    const newId = () => `id${++next}`

    async function seedMe(bookmarks: number, prefix: string): Promise<void> {
      const data = makePracticeData({ bookmarks, prefix })
      await db.bookmarks.bulkPut([...data.bookmarks])
      await db.sessions.bulkPut([...data.sessions])
      await db.playRecords.bulkPut([...data.playRecords])
      await db.handAssignments.bulkPut([...data.handAssignments])
    }

    it('round-trips profiles, bookmarks and the play log; a re-import adds nothing', async () => {
      await seedMe(3, 'A')
      await db.profiles.put({ id: 'p2', name: 'Anna', color: '#FFB38A', createdAt: 5 })
      const zip = await library.exportArchive()
      await db.bookmarks.clear()
      await db.playRecords.clear()
      await db.profiles.delete('p2')

      const prepared = await library.prepareImport(zip)
      // Nothing is written until the import is applied.
      expect(await db.bookmarks.count()).toBe(0)
      expect(prepared.collisions.map((c) => c.defaultChoice)).toEqual(['merge'])
      const report = await library.applyImport(prepared, new Map([['default', 'merge']]), newId)
      expect(report.profiles).toEqual({
        merged: [{ name: 'Me', bookmarksAdded: 3 }],
        replaced: [],
        addedProfiles: 1,
      })
      expect(await db.bookmarks.count()).toBe(3)
      expect(await db.playRecords.count()).toBe(3)
      expect((await db.profiles.toArray()).map((p) => p.name).sort()).toEqual(['Anna', 'Me'])

      const again = await library.applyImport(await library.prepareImport(zip), new Map(), newId)
      // Both profiles exist now: each collision merges and adds nothing.
      expect(again.profiles.merged).toEqual([
        { name: 'Me', bookmarksAdded: 0 },
        { name: 'Anna', bookmarksAdded: 0 },
      ])
      expect(await db.bookmarks.count()).toBe(3)
      expect(await db.profiles.count()).toBe(2)
    })

    it('Add as new and Replace write what the plan says', async () => {
      await seedMe(2, 'B')
      const zip = await library.exportArchive()
      await seedMe(4, 'L')

      await library.applyImport(
        await library.prepareImport(zip),
        new Map([['default', 'addNew']]),
        newId,
      )
      const imported = (await db.profiles.toArray()).find((p) => p.name === 'Me (imported)')
      expect(imported).toBeDefined()
      expect(
        await db.bookmarks
          .where('[profileId+songId]')
          .between([imported?.id, ''], [imported?.id, '\uffff'])
          .count(),
      ).toBe(2)

      await library.applyImport(
        await library.prepareImport(zip),
        new Map([['default', 'replace']]),
        newId,
      )
      const mine = await db.bookmarks.toArray()
      expect(
        mine
          .filter((b) => b.profileId === 'default')
          .map((b) => b.id)
          .sort(),
      ).toEqual(['Bb1', 'Bb2'])
    })
  })
})
