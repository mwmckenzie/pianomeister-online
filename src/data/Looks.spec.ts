// @vitest-environment node
import 'fake-indexeddb/auto'

import { Dexie } from 'dexie'
import { reactive } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import { captureLook } from '@/core/looks/lookValues'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'

import { Looks } from './Looks'
import { PianoMeisterDb } from './PianoMeisterDb'

let name = ''
let count = 0

afterEach(async () => {
  await Dexie.delete(name)
})

function open(): { db: PianoMeisterDb; looks: Looks } {
  name = `looks-${++count}`
  const db = new PianoMeisterDb(name)
  return { db, looks: new Looks(db) }
}

const look = (id: string, createdAt: string) =>
  captureLook(DEFAULT_SETTINGS, id, `Look ${id}`, createdAt)

describe('Looks', () => {
  it('stores, lists in the order saved, updates and deletes', async () => {
    const { db, looks } = open()
    await looks.put(look('b', '2026-11-22T10:00:00.002Z'))
    // Reactive state from the UI is stored as plain data.
    await looks.put(reactive(look('a', '2026-11-22T10:00:00.001Z')))
    expect((await looks.list()).map((l) => l.id)).toEqual(['a', 'b'])
    await looks.put({ ...look('a', '2026-11-22T10:00:00.001Z'), name: 'Renamed' })
    expect((await looks.list()).map((l) => l.name)).toEqual(['Renamed', 'Look b'])
    await looks.delete('b')
    expect((await looks.list()).map((l) => l.id)).toEqual(['a'])
    db.close()
  })

  it('adopts looks from localStorage once, keeping ones already moved', async () => {
    const { db, looks } = open()
    await looks.put({ ...look('a', '2026-11-22T10:00:00.001Z'), name: 'Already here' })
    await looks.adopt([
      look('a', '2026-11-22T10:00:00.001Z'),
      look('c', '2026-11-22T10:00:00.003Z'),
    ])
    await looks.adopt([look('c', '2026-11-22T10:00:00.003Z')])
    expect((await looks.list()).map((l) => [l.id, l.name])).toEqual([
      ['a', 'Already here'],
      ['c', 'Look c'],
    ])
    db.close()
  })
})
