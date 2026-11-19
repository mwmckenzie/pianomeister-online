// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { Bookmark } from './Bookmark'
import { autoBookmarkName } from './bookmarkNames'
import { nowPlaying } from './nowPlaying'
import type { PracticeConfig } from './PracticeConfig'

const BARS = { first: 1, last: 64 }

/** The global settings' Full song: whole song, 100%, both hands, pre-roll 2, no metronome. */
const FULL: PracticeConfig = {
  loop: null,
  tempoPercent: 100,
  handAudio: { right: 'on', left: 'on' },
  preRollBeats: 2,
  preRollMode: 'muted',
  metronomeMode: 'off',
}

function bookmark(id: string, name: string, config: Partial<PracticeConfig>): Bookmark {
  return {
    id,
    profileId: 'p1',
    songId: 'song',
    name,
    autoName: false,
    config: { ...FULL, loop: { startBar: 17, endBar: 32 }, ...config } as Bookmark['config'],
    createdAt: 0,
    updatedAt: 0,
  }
}

const B_SECTION = bookmark('b1', 'B section', { tempoPercent: 85 })
const OPENING = bookmark('b2', 'Opening', { loop: { startBar: 1, endBar: 4 } })
const BOOKMARKS = [B_SECTION, OPENING]

describe('nowPlaying', () => {
  it('is the bookmark the setup matches exactly, with its name', () => {
    const now = nowPlaying('song', B_SECTION.config, BOOKMARKS, FULL, BARS)
    expect(now).toEqual({
      kind: 'bookmark',
      bookmark: B_SECTION,
      entryId: 'b1',
      label: 'B section',
    })
  })

  it('adopts another bookmark when the settings come to match it', () => {
    // Loaded B section, then moved the loop to 1–4 and the tempo back to 100%: that's Opening.
    const setup = { ...B_SECTION.config, loop: { startBar: 1, endBar: 4 }, tempoPercent: 100 }
    expect(nowPlaying('song', setup, BOOKMARKS, FULL, BARS)).toMatchObject({
      kind: 'bookmark',
      entryId: 'b2',
      label: 'Opening',
    })
  })

  it('is Full song with no loop, 100%, and hands, pre-roll and metronome as the settings', () => {
    expect(nowPlaying('song', FULL, BOOKMARKS, FULL, BARS)).toEqual({
      kind: 'fullSong',
      entryId: 'full:song',
      label: 'Full song',
    })
    // Any difference from the global settings is a custom setup.
    const quiet = { ...FULL, preRollMode: 'quiet' as const }
    expect(nowPlaying('song', quiet, BOOKMARKS, FULL, BARS).kind).toBe('custom')
  })

  it('is a custom setup otherwise, labelled exactly like an automatic bookmark name', () => {
    const setup: PracticeConfig = {
      ...FULL,
      loop: { startBar: 20, endBar: 35 },
      preRollMode: 'quiet',
    }
    const now = nowPlaying('song', setup, BOOKMARKS, FULL, BARS)
    expect(now).toEqual({
      kind: 'custom',
      entryId: null,
      label: 'Bars 20–35 · 100% · both hands · quiet pre-roll 2',
    })
    expect(now.label).toBe(autoBookmarkName({ ...setup, loop: { startBar: 20, endBar: 35 } }))
  })

  it('names the whole song "Full song" in a custom setup without a loop', () => {
    const setup: PracticeConfig = {
      ...FULL,
      tempoPercent: 85,
      handAudio: { right: 'on', left: 'muted' },
    }
    expect(nowPlaying('song', setup, BOOKMARKS, FULL, BARS).label).toBe(
      'Full song · 85% · left muted · pre-roll 2',
    )
  })

  it('compares a bookmark range beyond the song clamped, as it is loaded', () => {
    const long = bookmark('b3', 'Coda', { loop: { startBar: 60, endBar: 80 } })
    const setup = { ...long.config, loop: { startBar: 60, endBar: 64 } }
    expect(nowPlaying('song', setup, [long], FULL, BARS)).toMatchObject({ entryId: 'b3' })
  })

  it("ignores another song's bookmarks", () => {
    const elsewhere = { ...B_SECTION, songId: 'other' }
    expect(nowPlaying('song', B_SECTION.config, [elsewhere], FULL, BARS).kind).toBe('custom')
  })
})
