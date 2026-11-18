import 'fake-indexeddb/auto'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Bookmarks } from '@/data/Bookmarks'

import { useBookmarkStore } from './bookmarkStore'

const CONFIG = {
  loop: { startBar: 1, endBar: 4 },
  tempoPercent: 100,
  handAudio: { right: 'on', left: 'on' },
  preRollBeats: 0,
  preRollMode: 'muted',
  metronomeMode: 'off',
} as const

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('bookmark store', () => {
  it('creates auto-named bookmarks and finds one with the same settings', async () => {
    const store = useBookmarkStore()
    const created = await store.create('song-a', CONFIG)
    expect(created).toMatchObject({
      name: 'Bars 1–4 · 100% · both hands · no pre-roll',
      autoName: true,
    })
    expect(store.findSame({ songId: 'song-a', config: { ...CONFIG } })?.id).toBe(created.id)
    expect(store.findSame({ songId: 'song-a', config: CONFIG }, created.id)).toBeNull()
    expect(store.findSame({ songId: 'song-b', config: CONFIG })).toBeNull()
    await store.remove(created.id)
  })

  it('keeps an edit made while a reload is reading (no stale overwrite)', async () => {
    const store = useBookmarkStore()
    const created = await store.create('song-c', CONFIG, { name: 'Opening' })
    // The reload reads now, but its result arrives only after the edit.
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const read = Bookmarks.prototype.forProfile
    const spy = vi.spyOn(Bookmarks.prototype, 'forProfile').mockImplementationOnce(function (
      this: Bookmarks,
      profileId: string,
    ) {
      const rows = read.call(this, profileId)
      return gate.then(() => rows)
    })
    const reading = store.refresh()
    await vi.waitFor(() => expect(spy).toHaveBeenCalled())
    await store.update(created.id, { config: { ...CONFIG, tempoPercent: 70 } })
    release()
    await reading
    expect(store.byId.get(created.id)?.config.tempoPercent).toBe(70)
    await store.refresh()
    expect(store.byId.get(created.id)?.config.tempoPercent).toBe(70)
    await store.remove(created.id)
  })
})
