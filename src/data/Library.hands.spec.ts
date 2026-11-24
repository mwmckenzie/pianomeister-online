// @vitest-environment node
import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { detectSongHands } from '@/core/hands/detectSongHands'
import type { HandSettings } from '@/core/hands/HandSettings'
import * as resolver from '@/core/hands/resolveSongHands'
import type { SongManifest } from '@/core/library/SongManifest'
import { writeMidiFile } from '@/core/midi/writeMidiFile'
import { demoCombined } from '@/core/testing/handDemos'

import type { BundledSongs } from './BundledSongs'
import { Library } from './Library'
import { NEW_DATABASE_KEY, PianoMeisterDb } from './PianoMeisterDb'

const songsDir = new URL('../../public/songs/', import.meta.url)
const bundled: BundledSongs = {
  manifest: async () =>
    JSON.parse(readFileSync(new URL('manifest.json', songsDir), 'utf8')) as SongManifest,
  bytes: async (fileName) => new Uint8Array(readFileSync(new URL(fileName, songsDir))),
}

let db: PianoMeisterDb
let library: Library
let count = 0

beforeEach(() => {
  db = new PianoMeisterDb(`hands-${count++}`)
  library = new Library(db, bundled, { requestPersistence: async () => true })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})

const minuet = async () => (await library.entries())[0]?.songId ?? ''

async function uploadCombined(): Promise<string> {
  const bytes = writeMidiFile(demoCombined())
  const [result] = await library.upload([
    { name: 'x.mid', size: bytes.byteLength, arrayBuffer: async () => bytes.slice().buffer },
  ])
  if (result?.outcome !== 'added') throw new Error('upload failed')
  return result.songId
}

const detect = async (songId: string) => {
  const detected = detectSongHands(await library.songBytes(songId), 'beam')
  await library.saveDetection(songId, detected)
  return detected
}

/** Notes per hand as the player gets them. */
async function heard(songId: string) {
  const { song, handOf } = await library.openSong(songId)
  const hands = song.notes.map(handOf)
  const of = (hand: string | null) => hands.filter((h) => h === hand).length
  return { right: of('right'), left: of('left'), hidden: of(null) }
}

async function setHands(songId: string, change: Partial<HandSettings>) {
  const { settings } = await library.handDetails(songId)
  const next = { ...settings, ...change }
  await library.setHands(
    songId,
    next,
    resolver.resolveSongHands(await library.songBytes(songId), next),
  )
}

describe('hands of a song', () => {
  it('are the default map until detected, then detected, then the player’s', async () => {
    const id = await uploadCombined()
    const all = (await library.openSong(id)).song.notes.length
    expect(await heard(id)).toEqual({ right: all, left: 0, hidden: 0 })
    expect((await library.entry(id))?.hands.source).toBe('default')

    const detected = await detect(id)
    const split = await heard(id)
    expect(split.right).toBeGreaterThan(20)
    expect(split.left).toBeGreaterThan(20)
    expect((await library.entry(id))?.hands).toEqual({
      source: 'detected',
      confidence: detected.confidence,
      summary: detected.resolved.summary,
    })

    await setHands(id, { roles: { '1:3': 'left' } })
    expect(await heard(id)).toEqual({ right: 0, left: all, hidden: 0 })
    expect((await library.entry(id))?.hands.source).toBe('user')
    // Detecting again changes nothing for this profile…
    await detect(id)
    expect(await heard(id)).toEqual({ right: 0, left: all, hidden: 0 })
    // …and another profile has the detected hands.
    library.setProfile('p2')
    expect(await heard(id)).toEqual(split)
  })

  it('keep flips, and hidden voices hidden', async () => {
    const id = await uploadCombined()
    await detect(id)
    const before = await heard(id)
    const { song, handOf } = await library.openSong(id)
    const first = song.notes.find((n) => handOf(n) === 'right')
    await setHands(id, { flips: { [first?.id ?? '']: 'L' } })
    expect(await heard(id)).toEqual({ ...before, right: before.right - 1, left: before.left + 1 })
    await setHands(id, { roles: { '1:3': 'hidden' } })
    expect((await heard(id)).hidden).toBe(song.notes.length)
  })

  it('are read from the cache; only a stale hash resolves again', async () => {
    const id = await uploadCombined()
    await detect(id)
    await setHands(id, { algorithm: 'fixed' })
    const expected = await heard(id)
    const resolve = vi.spyOn(resolver, 'resolveSongHands')
    await heard(id)
    expect(resolve).not.toHaveBeenCalled()
    const row = await db.handAssignments.get(['default', id])
    if (row === undefined || !('settings' in row)) throw new Error('no row')
    await db.handAssignments.put({
      ...row,
      resolved: { ...row.resolved, hash: 'old', hands: '---' },
    })
    expect(await heard(id)).toEqual(expected)
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(await db.handAssignments.get(['default', id])).toEqual(row)
  })

  it('go with a deleted upload', async () => {
    const id = await uploadCombined()
    const detected = await detect(id)
    await setHands(id, {})
    await library.deleteUpload(id)
    expect(await db.handDetections.count()).toBe(0)
    expect(await db.handAssignments.count()).toBe(0)
    expect(await library.saveDetection(id, detected)).toBe(false)
    expect(await db.handDetections.count()).toBe(0)
  })

  it('survive a backup, flips included', async () => {
    const id = await uploadCombined()
    await detect(id)
    await setHands(id, { flips: { '1:4': 'R' }, params: { reach: 14 } })
    const row = await db.handAssignments.get(['default', id])
    const zip = await library.exportArchive()
    await db.handAssignments.clear()
    await library.deleteUpload(id)
    await library.applyImport(await library.prepareImport(zip), new Map())
    expect(await db.handAssignments.get(['default', id])).toEqual(row)
    expect((await library.entry(id))?.hands.source).toBe('user')
  })
})

describe('channel maps from before milestone 10.5', () => {
  const old = (songId: string, right: number[], left: number[], profileId = 'default') =>
    db.handAssignments.put({ profileId, songId, hands: { right, left } })

  it('stay exactly what the player had, as voice roles', async () => {
    const id = await minuet()
    await old(id, [1], [])
    expect((await library.entry(id))?.hands.source).toBe('user')
    await detect(id)
    expect(await heard(id)).toEqual({ right: 150, left: 0, hidden: 258 })
    expect(await db.handAssignments.get(['default', id])).toMatchObject({
      settings: { roles: { '0:0': 'hidden', '1:1': 'right' }, flips: {} },
      resolved: { summary: { right: 150, left: 0 } },
    })
    expect((await library.entry(id))?.hands.source).toBe('user')
  })

  it('are dropped when they equal the default, so detection decides', async () => {
    const id = await minuet()
    // Channel 5 has no notes: the map is the default in effect.
    await old(id, [0], [1, 5])
    expect((await library.entry(id))?.hands.source).toBe('default')
    await library.openSong(id)
    expect(await db.handAssignments.count()).toBe(0)
    await detect(id)
    expect((await library.entry(id))?.hands.source).toBe('detected')
  })

  it('are converted for every profile, from the details too', async () => {
    const id = await minuet()
    await old(id, [1], [0])
    await old(id, [], [0], 'p2')
    const details = await library.handDetails(id)
    expect(details.settings.roles).toEqual({ '0:0': 'left', '1:1': 'right' })
    expect(await heard(id)).toEqual({ right: 150, left: 258, hidden: 0 })
    library.setProfile('p2')
    expect(await heard(id)).toEqual({ right: 0, left: 258, hidden: 150 })
  })

  it('still import from an older backup', async () => {
    const id = await minuet()
    await old(id, [1], [0])
    const zip = await library.exportArchive()
    await db.handAssignments.clear()
    await library.applyImport(await library.prepareImport(zip), new Map())
    expect(await heard(id)).toEqual({ right: 150, left: 258, hidden: 0 })
  })
})

describe('the background pass', () => {
  it('covers every song once, and after a detector change only older detections', async () => {
    const all = (await library.entries()).map((e) => e.songId)
    expect(await library.songsToDetect()).toEqual(all)
    const first = await detect(all[0] ?? '')
    expect(await library.songsToDetect()).toEqual(all.slice(1))
    await library.finishHandsPass()
    expect(await library.songsToDetect()).toEqual([])
    // An older pass: only what an older detector found is done again.
    await db.appState.put({ key: 'handsPass', value: '0.5' })
    await db.handDetections.put({ songId: all[0] ?? '', ...first, detectorVersion: 0 })
    expect(await library.songsToDetect()).toEqual([all[0]])
  })

  it('is quiet in a database made by this version', async () => {
    expect(await library.handsPassIsQuiet()).toBe(true)
    await db.appState.delete(NEW_DATABASE_KEY)
    expect(await library.handsPassIsQuiet()).toBe(false)
  })
})
