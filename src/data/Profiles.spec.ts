// @vitest-environment node
import 'fake-indexeddb/auto'

import { Dexie } from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { makePracticeData } from '@/core/testing/makePracticeData'

import { Bookmarks } from './Bookmarks'
import { PianoMeisterDb } from './PianoMeisterDb'
import { PlayLog } from './PlayLog'
import { Profiles } from './Profiles'

let db: PianoMeisterDb
let profiles: Profiles
let count = 0

beforeEach(() => {
  db = new PianoMeisterDb(`profiles-${count++}`)
  let n = 0
  profiles = new Profiles(db, () => `p${++n}`)
})

afterEach(async () => {
  db.close()
  await Dexie.delete(db.name)
})

async function seed(profileId: string, prefix: string): Promise<void> {
  const data = makePracticeData({ profileId, prefix, bookmarks: 2 })
  await db.bookmarks.bulkPut([...data.bookmarks])
  await db.sessions.bulkPut([...data.sessions])
  await db.playRecords.bulkPut([...data.playRecords])
  await db.handAssignments.bulkPut([...data.handAssignments])
  await db.appState.put({ key: `lastOpened:${profileId}`, value: '{}' })
}

describe('Profiles', () => {
  it('starts with "Me", active', async () => {
    expect((await profiles.list()).map((p) => p.name)).toEqual(['Me'])
    expect(await profiles.activeId()).toBe('default')
  })

  it('creates, renames, recolours and switches', async () => {
    const anna = await profiles.create('  Anna ', '#FFB38A', 10)
    await profiles.update(anna.id, { name: 'Anna B', color: '#D3A6FF' })
    await profiles.setActive(anna.id)
    expect(await profiles.list()).toEqual([
      expect.objectContaining({ id: 'default' }),
      { id: 'p1', name: 'Anna B', color: '#D3A6FF', createdAt: 10 },
    ])
    expect(await profiles.activeId()).toBe('p1')
  })

  it('deletes a profile with everything that belongs to it, and nothing else', async () => {
    const anna = await profiles.create('Anna', '#FFB38A')
    await seed('default', 'M')
    await seed(anna.id, 'A')
    await profiles.setActive(anna.id)
    await profiles.delete(anna.id)
    expect((await profiles.list()).map((p) => p.id)).toEqual(['default'])
    expect(await profiles.activeId()).toBe('default')
    for (const table of [db.bookmarks, db.sessions, db.playRecords, db.handAssignments]) {
      const rows: { profileId: string }[] = await table.toArray()
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.profileId === 'default')).toBe(true)
    }
    expect(await db.appState.get(`lastOpened:${anna.id}`)).toBeUndefined()
    expect(await db.appState.get('lastOpened:default')).toBeDefined()
  })

  it("won't delete the last profile", async () => {
    await expect(profiles.delete('default')).rejects.toThrow(/last profile/)
    expect(await profiles.list()).toHaveLength(1)
  })
})

describe('Bookmarks and PlayLog', () => {
  it('lists a profile bookmarks and puts, deletes and restores them', async () => {
    const bookmarks = new Bookmarks(db)
    await seed('default', 'M')
    await seed('p2', 'A')
    const mine = await bookmarks.forProfile('default')
    expect(mine.map((b) => b.id)).toEqual(['Mb1', 'Mb2'])
    const [first] = mine
    await bookmarks.delete('Mb1')
    expect((await bookmarks.forProfile('default')).map((b) => b.id)).toEqual(['Mb2'])
    if (first) await bookmarks.put(first)
    expect((await bookmarks.forProfile('default')).map((b) => b.id)).toEqual(['Mb1', 'Mb2'])
  })

  it('stores recorder writes as upserts and finds the last session', async () => {
    const log = new PlayLog(db)
    const session = { id: 's1', profileId: 'default', startedAt: 0, endedAt: 10 }
    const record = {
      id: 'r1',
      profileId: 'default',
      sessionId: 's1',
      songId: 'song',
      bookmarkId: 'full:song',
      startedAt: 0,
      playedMs: 10,
      plays: 0,
    }
    await log.write({ record, session })
    await log.write({ record: { ...record, playedMs: 40 }, session: { ...session, endedAt: 40 } })
    await log.write({
      record: { ...record, id: 'r2', sessionId: 's2' },
      session: { id: 's2', profileId: 'default', startedAt: 1000, endedAt: 2000 },
    })
    expect((await log.records('default')).map((r) => [r.id, r.playedMs])).toEqual([
      ['r1', 40],
      ['r2', 10],
    ])
    expect((await log.lastSession('default'))?.id).toBe('s2')
    expect(await log.lastSession('nobody')).toBeNull()
  })
})
