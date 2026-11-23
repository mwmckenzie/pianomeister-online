// @vitest-environment node
import 'fake-indexeddb/auto'

import { Dexie } from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readFixture } from '@/core/testing/readFixture'

import { FACTS_VERSION } from '@/core/library/FACTS_VERSION'

import { DEFAULT_PROFILE } from '@/core/profiles/DEFAULT_PROFILE'

import { PianoMeisterDb } from './PianoMeisterDb'
import { factsFailureKey, refreshStaleFacts } from './refreshStaleFacts'
import type { StoredUpload } from './StoredUpload'

/** Upload facts as milestone 4 stored them: no tempo range. */
const v1Facts = {
  durationSeconds: 1,
  durationTicks: 1,
  ppq: 480,
  bars: 1,
  timeSignatures: ['4/4'],
  bpm: 99,
}

const upload = (songId: string, bytes: Uint8Array): StoredUpload => ({
  songId,
  fileName: `${songId}.mid`,
  title: songId,
  addedAt: 1,
  facts: v1Facts,
  bytes: bytes.slice().buffer,
})

let name = ''

afterEach(async () => {
  await Dexie.delete(name)
  vi.restoreAllMocks()
})

/** Creates a database exactly as version 1 of the schema did, with some uploads. */
async function createV1(
  uploads: readonly StoredUpload[],
  seed: (db: Dexie) => Promise<unknown> = async () => undefined,
): Promise<void> {
  const v1 = new Dexie(name)
  v1.version(1).stores({
    uploads: 'songId, addedAt',
    songMeta: 'songId',
    meterOverrides: 'songId',
    handAssignments: '[profileId+songId], songId',
    appState: 'key',
  })
  await v1.table('uploads').bulkPut([...uploads])
  await seed(v1)
  v1.close()
}

describe('PianoMeisterDb upgrade to v2', () => {
  it('opens a v1 database as v2 with its uploads untouched (facts are refreshed separately)', async () => {
    name = 'upgrade-schema'
    await createV1([upload('minuet', readFixture('minuet-in-g.mid'))])
    const db = new PianoMeisterDb(name)
    expect((await db.uploads.get('minuet'))?.facts).toEqual(v1Facts)
    expect(db.verno).toBe(8)
    db.close()
  })
})

describe('PianoMeisterDb upgrade to v3', () => {
  it('creates "Me", keeps hand assignments with it and moves the last song to it', async () => {
    name = 'upgrade-v3'
    await createV1([], async (v1) => {
      await v1.table('handAssignments').put({
        profileId: 'default',
        songId: 'minuet',
        hands: { right: [1], left: [0] },
      })
      await v1.table('appState').put({ key: 'lastSongId', value: 'minuet' })
    })
    const db = new PianoMeisterDb(name)
    expect(await db.profiles.toArray()).toEqual([DEFAULT_PROFILE])
    expect(await db.handAssignments.get(['default', 'minuet'])).toMatchObject({
      hands: { right: [1], left: [0] },
    })
    expect(await db.appState.get('lastSongId')).toBeUndefined()
    expect(JSON.parse((await db.appState.get('lastOpened:default'))?.value ?? '')).toEqual({
      songId: 'minuet',
      bookmarkId: null,
    })
    db.close()
  })

  it('creates "Me" in a new database', async () => {
    name = 'fresh-v3'
    const db = new PianoMeisterDb(name)
    expect(await db.profiles.toArray()).toEqual([DEFAULT_PROFILE])
    db.close()
  })
})

describe('PianoMeisterDb upgrade to v4', () => {
  it('makes old range-label bookmark names automatic and keeps custom names', async () => {
    name = 'upgrade-v4'
    const v3 = new Dexie(name)
    v3.version(3).stores({
      uploads: 'songId, addedAt',
      songMeta: 'songId',
      meterOverrides: 'songId',
      handAssignments: '[profileId+songId], songId',
      appState: 'key',
      profiles: 'id',
      bookmarks: 'id, [profileId+songId], songId',
      sessions: 'id, profileId, [profileId+endedAt]',
      playRecords:
        'id, [profileId+songId], [profileId+bookmarkId], [profileId+startedAt], profileId, songId',
    })
    const config = {
      loop: { startBar: 17, endBar: 32 },
      tempoPercent: 85,
      handAudio: { right: 'on', left: 'muted' },
      preRollBeats: 0,
      preRollMode: 'muted',
    }
    const row = { profileId: 'default', songId: 's', config, createdAt: 1, updatedAt: 1 }
    await v3.table('bookmarks').bulkPut([
      { ...row, id: 'a', name: 'Bars 17–32' },
      { ...row, id: 'b', name: 'B section' },
    ])
    v3.close()
    const db = new PianoMeisterDb(name)
    expect(await db.bookmarks.get('a')).toMatchObject({
      autoName: true,
      name: 'Bars 17–32 · 85% · left muted · no pre-roll',
    })
    expect(await db.bookmarks.get('b')).toMatchObject({ autoName: false, name: 'B section' })
    db.close()
  })
})

describe('PianoMeisterDb upgrade to v5', () => {
  it('turns each record’s complete passes into plays and touches nothing else', async () => {
    name = 'upgrade-v5'
    const v4 = new Dexie(name)
    v4.version(4).stores({
      uploads: 'songId, addedAt',
      songMeta: 'songId',
      meterOverrides: 'songId',
      handAssignments: '[profileId+songId], songId',
      appState: 'key',
      profiles: 'id',
      bookmarks: 'id, [profileId+songId], songId',
      sessions: 'id, profileId, [profileId+endedAt]',
      playRecords:
        'id, [profileId+songId], [profileId+bookmarkId], [profileId+startedAt], profileId, songId',
    })
    const row = {
      profileId: 'default',
      sessionId: 's1',
      songId: 'song',
      startedAt: 1,
      playedMs: 60_000,
      tempoPercent: 85,
      loop: null,
      metronomeMode: 'off',
      temporary: true,
    }
    await v4.table('playRecords').bulkPut([
      { ...row, id: 'a', bookmarkId: 'b1', passes: 3 },
      { ...row, id: 'b', bookmarkId: 'full:song', passes: 0 },
    ])
    v4.close()
    const db = new PianoMeisterDb(name)
    const a = await db.playRecords.get('a')
    expect(a).toEqual({ ...row, id: 'a', bookmarkId: 'b1', plays: 3 })
    expect(await db.playRecords.get('b')).toMatchObject({ plays: 0, bookmarkId: 'full:song' })
    expect(a).not.toHaveProperty('passes')
    db.close()
  })
})

describe('PianoMeisterDb upgrade to v6', () => {
  it('adds an empty looks table and keeps every other table', async () => {
    name = 'upgrade-v6'
    const v5 = new Dexie(name)
    v5.version(5).stores({
      uploads: 'songId, addedAt',
      songMeta: 'songId',
      meterOverrides: 'songId',
      handAssignments: '[profileId+songId], songId',
      appState: 'key',
      profiles: 'id',
      bookmarks: 'id, [profileId+songId], songId',
      sessions: 'id, profileId, [profileId+endedAt]',
      playRecords:
        'id, [profileId+songId], [profileId+bookmarkId], [profileId+startedAt], profileId, songId',
    })
    await v5.table('profiles').put({ id: 'p1', name: 'Ann', color: '#FFFFFF', createdAt: 1 })
    v5.close()
    const db = new PianoMeisterDb(name)
    expect(await db.looks.count()).toBe(0)
    expect(await db.profiles.get('p1')).toMatchObject({ name: 'Ann' })
    db.close()
  })

  it('adds an empty playlists table at v8 and keeps the looks', async () => {
    name = 'upgrade-v8'
    const v7 = new Dexie(name)
    v7.version(7).stores({
      uploads: 'songId, addedAt',
      songMeta: 'songId',
      meterOverrides: 'songId',
      handAssignments: '[profileId+songId], songId',
      appState: 'key',
      profiles: 'id',
      bookmarks: 'id, [profileId+songId], songId',
      sessions: 'id, profileId, [profileId+endedAt]',
      playRecords:
        'id, [profileId+songId], [profileId+bookmarkId], [profileId+startedAt], profileId, songId',
      looks: 'id, createdAt',
    })
    await v7.table('looks').put({ id: 'l1', name: 'Mine', createdAt: 'x', values: {} })
    v7.close()
    const db = new PianoMeisterDb(name)
    expect(await db.playlists.count()).toBe(0)
    expect(await db.looks.get('l1')).toMatchObject({ name: 'Mine' })
    db.close()
  })

  it('migrates saved looks to settings v9: the black lift goes, head height becomes white', async () => {
    name = 'upgrade-v7'
    const v6 = new Dexie(name)
    v6.version(6).stores({
      uploads: 'songId, addedAt',
      songMeta: 'songId',
      meterOverrides: 'songId',
      handAssignments: '[profileId+songId], songId',
      appState: 'key',
      profiles: 'id',
      bookmarks: 'id, [profileId+songId], songId',
      sessions: 'id, profileId, [profileId+endedAt]',
      playRecords:
        'id, [profileId+songId], [profileId+bookmarkId], [profileId+startedAt], profileId, songId',
      looks: 'id, createdAt',
    })
    await v6.table('looks').put({
      id: 'look-1',
      name: 'Tall',
      createdAt: '2026-11-22T10:00:00.000Z',
      updatedAt: '2026-11-22T10:00:00.000Z',
      builtIn: false,
      values: {
        'notes.headHeight': 0.6,
        'notes.blackLiftMode': 'manual',
        'notes.blackLift': 0.3,
        'camera.tiltDeg': 30,
      },
    })
    v6.close()
    const db = new PianoMeisterDb(name)
    const look = await db.looks.get('look-1')
    expect(look?.values).toEqual({ 'notes.whiteHeadHeight': 0.6, 'camera.tiltDeg': 30 })
    db.close()
  })
})

describe('refreshStaleFacts', () => {
  it('recomputes facts with a missing or older version, one at a time, and reports each', async () => {
    name = 'refresh-stale'
    await createV1([
      upload('minuet', readFixture('minuet-in-g.mid')),
      { ...upload('canon', readFixture('canon-in-d.mid')), facts: { ...v1Facts, factsVersion: 0 } },
    ])
    const db = new PianoMeisterDb(name)
    const seen: string[] = []
    const report = await refreshStaleFacts(db, (songId) => {
      seen.push(songId)
    })
    expect(report).toEqual({ refreshed: ['canon', 'minuet'], failed: [] })
    expect(seen).toEqual(['canon', 'minuet'])
    const minuet = (await db.uploads.get('minuet'))?.facts
    expect(minuet).toMatchObject({ factsVersion: FACTS_VERSION, bpmMin: 126, bars: 64 })
    expect(minuet?.channels?.map((c) => c.noteCount)).toEqual([258, 150])
    expect(minuet?.meter?.main).toBe('3/4')
    // Up to date now: a second pass does nothing.
    expect(await refreshStaleFacts(db)).toEqual({ refreshed: [], failed: [] })
    db.close()
  })

  it('keeps the old facts of a file that no longer parses and remembers the failure', async () => {
    name = 'refresh-corrupt'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await createV1([
      upload('broken', new Uint8Array([1, 2, 3, 4])),
      upload('minuet', readFixture('minuet-in-g.mid')),
    ])
    const db = new PianoMeisterDb(name)
    expect(await refreshStaleFacts(db)).toEqual({ refreshed: ['minuet'], failed: ['broken'] })
    expect((await db.uploads.get('broken'))?.facts).toEqual(v1Facts)
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain('broken.mid')
    // Not retried on the next load…
    expect(await refreshStaleFacts(db)).toEqual({ refreshed: [], failed: [] })
    // …but retried once FACTS_VERSION has moved past the failure.
    await db.appState.put({ key: factsFailureKey('broken'), value: String(FACTS_VERSION - 1) })
    expect(await refreshStaleFacts(db)).toEqual({ refreshed: [], failed: ['broken'] })
    db.close()
  })
})
