// @vitest-environment node
import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'

import { reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { SongManifest } from '@/core/library/SongManifest'
import { readFixture } from '@/core/testing/readFixture'

import { Library } from './Library'
import { PianoMeisterDb } from './PianoMeisterDb'

/**
 * Vue state is proxied, and IndexedDB's structured clone rejects proxies (DataCloneError).
 * The database converts every written value to plain data, so UI callers can pass reactive
 * state straight through. These tests write reactive objects through every table and path.
 */
const songsDir = new URL('../../public/songs/', import.meta.url)
const bundled = {
  manifest: async () =>
    JSON.parse(readFileSync(new URL('manifest.json', songsDir), 'utf8')) as SongManifest,
  bytes: async (fileName: string) => new Uint8Array(readFileSync(new URL(fileName, songsDir))),
}

let db: PianoMeisterDb
let library: Library
let count = 0

beforeEach(() => {
  db = new PianoMeisterDb(`reactive-${count++}`)
  library = new Library(db, bundled, { requestPersistence: async () => true })
})

afterEach(async () => {
  await db.delete()
})

const override = () => ({ timeSignature: { numerator: 3, denominator: 4 }, barOneStartTick: 0 })

describe('PianoMeisterDb with Vue reactive input', () => {
  it('stores reactive objects in every table as plain data', async () => {
    const facts = {
      durationSeconds: 1,
      durationTicks: 1,
      ppq: 480,
      bars: 1,
      timeSignatures: ['4/4'],
      bpm: 120,
    }
    await db.uploads.put(
      reactive({
        songId: 'u',
        fileName: 'u.mid',
        title: 'u',
        addedAt: 1,
        facts,
        bytes: new ArrayBuffer(4),
      }),
    )
    await db.songMeta.put(reactive({ songId: 's', edit: { title: 'T', tags: ['a', 'b'] } }))
    await db.meterOverrides.put(reactive({ songId: 's', override: override() }))
    await db.handAssignments.put(
      reactive({ profileId: 'default', songId: 's', hands: { right: [0], left: [1] } }),
    )
    await db.appState.put(reactive({ key: 'k', value: 'v' }))
    await db.songMeta.bulkPut([reactive({ songId: 't', edit: { tags: ['x'] } })])

    expect((await db.uploads.get('u'))?.bytes.byteLength).toBe(4)
    expect(await db.songMeta.get('s')).toEqual({
      songId: 's',
      edit: { title: 'T', tags: ['a', 'b'] },
    })
    expect((await db.meterOverrides.get('s'))?.override).toEqual(override())
    expect((await db.handAssignments.get(['default', 's']))?.hands).toEqual({
      right: [0],
      left: [1],
    })
    expect((await db.appState.get('k'))?.value).toBe('v')
    expect((await db.songMeta.get('t'))?.edit).toEqual({ tags: ['x'] })
  })

  it('accepts reactive input through every Library write path', async () => {
    const songId = (await library.entries())[0]?.songId ?? ''

    // "Swap hands": the arrays come from a deep ref, so each one is a proxy.
    const hands = ref({ right: [0], left: [1] })
    await library.setHands(songId, { right: hands.value.left, left: hands.value.right })
    expect((await library.openSong(songId)).hands).toEqual({ right: [1], left: [0] })
    // Per-channel change and restore default.
    await library.setHands(songId, reactive({ right: [0], left: [] }))
    expect((await library.openSong(songId)).hands).toEqual({ right: [0], left: [] })
    await library.resetHands(songId)
    expect((await library.openSong(songId)).defaultHands).toBe(true)

    await library.setMeta(songId, reactive({ title: 'Mine', composer: 'Me', tags: ['exam'] }))
    expect(await library.entry(songId)).toMatchObject({
      title: 'Mine',
      composer: 'Me',
      tags: ['exam'],
    })

    await library.setOverride(songId, reactive(override()))
    expect((await library.entry(songId))?.override).toEqual(override())

    const upload = reactive({
      name: 'pedal-demo.mid',
      size: readFixture('pedal-demo.mid').byteLength,
      arrayBuffer: async () => readFixture('pedal-demo.mid').slice().buffer,
    })
    expect(await library.upload([upload])).toMatchObject([{ outcome: 'added' }])
  })
})
