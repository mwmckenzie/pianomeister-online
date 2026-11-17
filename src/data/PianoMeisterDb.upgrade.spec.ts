// @vitest-environment node
import 'fake-indexeddb/auto'

import { Dexie } from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readFixture } from '@/core/testing/readFixture'

import { FACTS_VERSION } from '@/core/library/FACTS_VERSION'

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
async function createV1(uploads: readonly StoredUpload[]): Promise<void> {
  const v1 = new Dexie(name)
  v1.version(1).stores({
    uploads: 'songId, addedAt',
    songMeta: 'songId',
    meterOverrides: 'songId',
    handAssignments: '[profileId+songId], songId',
    appState: 'key',
  })
  await v1.table('uploads').bulkPut([...uploads])
  v1.close()
}

describe('PianoMeisterDb upgrade to v2', () => {
  it('opens a v1 database as v2 with its uploads untouched (facts are refreshed separately)', async () => {
    name = 'upgrade-schema'
    await createV1([upload('minuet', readFixture('minuet-in-g.mid'))])
    const db = new PianoMeisterDb(name)
    expect((await db.uploads.get('minuet'))?.facts).toEqual(v1Facts)
    expect(db.verno).toBe(2)
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
