import 'fake-indexeddb/auto'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { makeBookmark } from '@/core/testing/makePracticeData'

import { useBookmarkStore } from './bookmarkStore'
import { usePracticeStore } from './practiceStore'
import { useSettingsStore } from './settingsStore'

const SAVED = makeBookmark({
  id: 'b1',
  profileId: 'default',
  songId: 'song',
  name: 'B section',
  config: {
    loop: { startBar: 17, endBar: 32 },
    tempoPercent: 85,
    handAudio: { right: 'on', left: 'muted' },
    preRollBeats: 2,
    preRollMode: 'quiet',
    metronomeMode: 'off',
  },
})

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  useBookmarkStore().bookmarks = [SAVED]
})

function loadBookmark() {
  const practice = usePracticeStore()
  practice.load('song', 'b1', { first: 1, last: 64 })
  return practice
}

describe('practice store with a bookmark loaded', () => {
  it('plays the bookmark as saved, with no temporary changes', () => {
    const practice = loadBookmark()
    expect(practice.current).toEqual(SAVED.config)
    expect(practice.entryId).toBe('b1')
    expect(practice.changed).toEqual([])
    expect(practice.rangeMatchesSaved).toBe(true)
  })

  it('keeps player-side changes temporary: never in the bookmark or the settings', () => {
    const practice = loadBookmark()
    const settings = useSettingsStore()
    const before = settings.settings
    practice.setTempo(60)
    practice.setHandAudio('right', 'solo')
    practice.setPreRollBeats(4)
    practice.setPreRollMode('muted')
    practice.setLoop({ startBar: 17, endBar: 24 })
    expect(practice.current).toEqual({
      loop: { startBar: 17, endBar: 24 },
      tempoPercent: 60,
      handAudio: { right: 'solo', left: 'muted' },
      preRollBeats: 4,
      preRollMode: 'muted',
      metronomeMode: 'off',
    })
    expect(practice.changed).toEqual([
      'loop',
      'tempoPercent',
      'handAudio.right',
      'preRollBeats',
      'preRollMode',
    ])
    expect(practice.rangeMatchesSaved).toBe(false)
    expect(settings.settings).toBe(before)
    expect(useBookmarkStore().byId.get('b1')).toEqual(SAVED)
  })

  it('resets one field to the saved value, or reverts them all', () => {
    const practice = loadBookmark()
    practice.setTempo(60)
    practice.setPreRollBeats(4)
    practice.revertField('tempoPercent')
    expect(practice.current.tempoPercent).toBe(85)
    expect(practice.changed).toEqual(['preRollBeats'])
    practice.revert()
    expect(practice.changed).toEqual([])
  })

  it('counts a change back to the saved value as no change', () => {
    const practice = loadBookmark()
    practice.setTempo(60)
    practice.setTempo(85)
    expect(practice.changed).toEqual([])
  })

  it('drops temporary changes when anything else loads', () => {
    const practice = loadBookmark()
    practice.setTempo(60)
    practice.load('song', null, { first: 1, last: 64 })
    practice.load('song', 'b1', { first: 1, last: 64 })
    expect(practice.changed).toEqual([])
  })

  it('shows edits saved in the bookmark manager, and clamps a range past the last bar', () => {
    const practice = loadBookmark()
    useBookmarkStore().bookmarks = [
      { ...SAVED, config: { ...SAVED.config, loop: { startBar: 60, endBar: 80 } } },
    ]
    expect(practice.saved.loop).toEqual({ startBar: 60, endBar: 64 })
    expect(practice.changed).toEqual([])
  })
})

describe('practice store with Full song loaded', () => {
  it('plays the whole song at 100% with the settings, and loop and tempo as session state', () => {
    const practice = usePracticeStore()
    practice.load('song', null, { first: 1, last: 64 })
    expect(practice.entryId).toBe('full:song')
    expect(practice.current.loop).toBeNull()
    expect(practice.current.tempoPercent).toBe(100)
    practice.setTempo(70)
    practice.setLoop({ startBar: 1, endBar: 8 })
    expect(practice.current).toMatchObject({ tempoPercent: 70, loop: { startBar: 1, endBar: 8 } })
    expect(practice.changed).toEqual([])
    // A loop isn't Full song's range: time counts, passes don't.
    expect(practice.rangeMatchesSaved).toBe(false)
  })

  it('edits the global settings for hand modes and pre-roll', () => {
    const practice = usePracticeStore()
    const settings = useSettingsStore()
    practice.load('song', null, { first: 1, last: 64 })
    practice.setHandAudio('left', 'muted')
    practice.setPreRollBeats(3)
    expect(settings.settings.audio.leftAudio).toBe('muted')
    expect(settings.settings.practice.preRollBeats).toBe(3)
    expect(practice.current.handAudio.left).toBe('muted')
  })

  it('loads a deleted bookmark as nothing: its id is not found', () => {
    const practice = usePracticeStore()
    practice.load('song', 'gone', { first: 1, last: 64 })
    expect(practice.bookmark).toBeNull()
  })
})

describe('practice store loop jumps (brief decision 8)', () => {
  it('asks for a jump on every committed loop change, but not when the loop goes off', () => {
    const practice = usePracticeStore()
    practice.load('song', null, { first: 1, last: 64 })
    expect(practice.loopJump).toBe(0)
    practice.setLoop({ startBar: 5, endBar: 8 })
    expect(practice.loopJump).toBe(1)
    practice.setLoop({ startBar: 6, endBar: 8 })
    expect(practice.loopJump).toBe(2)
    practice.setLoop(null)
    expect(practice.loopJump).toBe(2)
  })

  it('jumps when a bookmark loads or is reverted, unless it was just saved', () => {
    const practice = loadBookmark()
    expect(practice.loopJump).toBe(1)
    practice.setTempo(70)
    practice.revert()
    expect(practice.loopJump).toBe(2)
    practice.revertField('tempoPercent')
    expect(practice.loopJump).toBe(2)
    practice.load('song', 'b1', { first: 1, last: 64 }, { jump: false })
    expect(practice.loopJump).toBe(2)
  })

  it('restores a snapshot: what was loaded and its temporary changes', () => {
    const practice = usePracticeStore()
    practice.load('song', null, { first: 1, last: 64 })
    practice.setLoop({ startBar: 3, endBar: 4 })
    practice.setTempo(80)
    const saved = practice.snapshot()
    practice.load('song', 'b1', { first: 1, last: 64 }, { jump: false })
    practice.restore(saved)
    expect(practice.bookmarkId).toBeNull()
    expect(practice.current.loop).toEqual({ startBar: 3, endBar: 4 })
    expect(practice.current.tempoPercent).toBe(80)
  })
})
