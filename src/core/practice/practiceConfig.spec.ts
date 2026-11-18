// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import type { PracticeConfig } from './PracticeConfig'
import { autoBookmarkName, isLegacyAutoName, rangeLabel, settleBookmark } from './bookmarkNames'
import { bookmarkSummary } from './bookmarkSummary'
import { clampRange } from './clampRange'
import { diffFromBookmark, sameRange } from './diffFromBookmark'
import { editBookmark } from './editBookmark'
import { fullSongId, isFullSongId } from './fullSongId'
import { fullSongConfig, newBookmarkConfig } from './practiceDefaults'
import { sameBookmarkSettings } from './sameBookmarkSettings'
import { tempoSliderRange } from './tempoSliderRange'

const base: PracticeConfig = {
  loop: { startBar: 17, endBar: 32 },
  tempoPercent: 85,
  handAudio: { right: 'on', left: 'on' },
  preRollBeats: 0,
  preRollMode: 'muted',
  metronomeMode: 'off',
}

describe('Full song', () => {
  it('has an id of its own per song', () => {
    expect(fullSongId('abc')).toBe('full:abc')
    expect(isFullSongId('full:abc')).toBe(true)
    expect(isFullSongId('bookmark-1')).toBe(false)
  })

  it('plays the whole song at 100% with the hands and pre-roll from the settings', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      audio: { ...DEFAULT_SETTINGS.audio, leftAudio: 'muted' as const },
      practice: { ...DEFAULT_SETTINGS.practice, preRollBeats: 4, preRollMode: 'quiet' as const },
    }
    expect(fullSongConfig(settings)).toEqual({
      loop: null,
      tempoPercent: 100,
      handAudio: { right: 'on', left: 'muted' },
      preRollBeats: 4,
      preRollMode: 'quiet',
      metronomeMode: 'off',
    })
  })
})

describe('newBookmarkConfig', () => {
  it('covers bars 1–4 with both hands on and the pre-roll from the settings', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      audio: { ...DEFAULT_SETTINGS.audio, rightAudio: 'solo' as const },
      practice: { ...DEFAULT_SETTINGS.practice, preRollBeats: 2, preRollMode: 'muted' as const },
    }
    expect(newBookmarkConfig(settings, 64)).toEqual({
      loop: { startBar: 1, endBar: 4 },
      tempoPercent: 100,
      handAudio: { right: 'on', left: 'on' },
      preRollBeats: 2,
      preRollMode: 'muted',
      metronomeMode: 'off',
    })
  })

  it('fits a song shorter than four bars', () => {
    expect(newBookmarkConfig(DEFAULT_SETTINGS, 2).loop).toEqual({ startBar: 1, endBar: 2 })
  })
})

describe('diffFromBookmark', () => {
  it('is empty when nothing changed', () => {
    expect(diffFromBookmark(base, { ...base, loop: { startBar: 17, endBar: 32 } })).toEqual([])
  })

  it('names every changed field', () => {
    const current: PracticeConfig = {
      loop: { startBar: 17, endBar: 24 },
      tempoPercent: 70,
      handAudio: { right: 'solo', left: 'muted' },
      preRollBeats: 2,
      preRollMode: 'quiet',
      metronomeMode: 'off',
    }
    expect(diffFromBookmark(base, current)).toEqual([
      'loop',
      'tempoPercent',
      'handAudio.right',
      'handAudio.left',
      'preRollBeats',
      'preRollMode',
    ])
  })

  it('counts turning the loop off as a range change', () => {
    expect(diffFromBookmark(base, { ...base, loop: null })).toEqual(['loop'])
    expect(sameRange(null, null)).toBe(true)
  })
})

describe('clampRange', () => {
  it('leaves a range inside the song alone', () => {
    expect(clampRange({ startBar: 5, endBar: 8 }, 1, 64)).toEqual({ startBar: 5, endBar: 8 })
  })

  it('fits a range past the last bar', () => {
    expect(clampRange({ startBar: 60, endBar: 80 }, 1, 64)).toEqual({ startBar: 60, endBar: 64 })
    expect(clampRange({ startBar: 70, endBar: 80 }, 1, 64)).toEqual({ startBar: 64, endBar: 64 })
  })
})

describe('names and summaries', () => {
  it('names a range', () => {
    expect(rangeLabel({ startBar: 17, endBar: 32 })).toBe('Bars 17–32')
    expect(rangeLabel({ startBar: 5, endBar: 5 })).toBe('Bar 5')
  })

  it('summarises a setup, leaving out defaults unless the hands are always named', () => {
    expect(bookmarkSummary(base, 64)).toBe('Bars 17–32 · 85%')
    expect(bookmarkSummary(base, 64, { alwaysHands: true })).toBe('Bars 17–32 · 85% · both hands')
    expect(
      bookmarkSummary({ ...base, handAudio: { right: 'on', left: 'muted' }, preRollBeats: 2 }, 64),
    ).toBe('Bars 17–32 · 85% · left muted · pre-roll 2')
    expect(bookmarkSummary({ ...base, loop: null, tempoPercent: 100 }, 64)).toBe('Bars 1–64 · 100%')
  })

  it('names every hand combination', () => {
    const hands = (right: 'on' | 'muted' | 'solo', left: 'on' | 'muted' | 'solo') =>
      bookmarkSummary({ ...base, handAudio: { right, left } }, 64).split(' · ')[2]
    expect(hands('muted', 'on')).toBe('right muted')
    expect(hands('solo', 'on')).toBe('right only')
    expect(hands('muted', 'solo')).toBe('left only')
    expect(hands('muted', 'muted')).toBe('both muted')
    expect(hands('solo', 'solo')).toBe('both hands')
  })
})

const saved = {
  ...base,
  loop: { startBar: 1, endBar: 4 },
  tempoPercent: 100,
  preRollBeats: 2,
}

describe('automatic bookmark names', () => {
  it('names every part, defaults included', () => {
    expect(autoBookmarkName(saved)).toBe('Bars 1–4 · 100% · both hands · pre-roll 2')
    expect(autoBookmarkName({ ...saved, preRollBeats: 0 })).toBe(
      'Bars 1–4 · 100% · both hands · no pre-roll',
    )
    expect(
      autoBookmarkName({
        ...saved,
        loop: { startBar: 9, endBar: 9 },
        tempoPercent: 70,
        handAudio: { right: 'solo', left: 'on' },
      }),
    ).toBe('Bar 9 · 70% · right only · pre-roll 2')
  })

  it('recognises the old range-label names', () => {
    expect(isLegacyAutoName('Bars 17–32')).toBe(true)
    expect(isLegacyAutoName('Bar 5')).toBe(true)
    expect(isLegacyAutoName('Bars 1-8')).toBe(true)
    expect(isLegacyAutoName('B section')).toBe(false)
    expect(isLegacyAutoName('Bars 17–32 slow')).toBe(false)
  })

  it('settles the flag of a bookmark stored before it existed', () => {
    const old = {
      id: 'b',
      profileId: 'default',
      songId: 's',
      name: 'Bars 1–4',
      config: saved,
      createdAt: 1,
      updatedAt: 1,
    }
    expect(settleBookmark(old)).toMatchObject({
      autoName: true,
      name: 'Bars 1–4 · 100% · both hands · pre-roll 2',
    })
    expect(settleBookmark({ ...old, name: 'Opening' })).toMatchObject({
      autoName: false,
      name: 'Opening',
    })
    // An auto-named one follows its settings; a custom one keeps its name.
    expect(settleBookmark({ ...old, autoName: true, name: 'stale' }).name).toBe(
      'Bars 1–4 · 100% · both hands · pre-roll 2',
    )
    expect(settleBookmark({ ...old, autoName: false, name: 'Bars 2–3' }).name).toBe('Bars 2–3')
  })
})

describe('sameBookmarkSettings', () => {
  const a = { songId: 's', config: saved }

  it('ignores the name and compares the song and every setting', () => {
    expect(sameBookmarkSettings(a, { songId: 's', config: { ...saved } })).toBe(true)
    expect(sameBookmarkSettings(a, { songId: 't', config: saved })).toBe(false)
    const differs = [
      { loop: { startBar: 1, endBar: 5 } },
      { loop: { startBar: 2, endBar: 4 } },
      { tempoPercent: 95 },
      { handAudio: { right: 'muted' as const, left: 'on' as const } },
      { handAudio: { right: 'on' as const, left: 'solo' as const } },
      { preRollBeats: 0 },
      { preRollMode: 'quiet' as const },
    ]
    for (const change of differs) {
      expect(sameBookmarkSettings(a, { songId: 's', config: { ...saved, ...change } })).toBe(false)
    }
  })
})

describe('editBookmark', () => {
  const auto = settleBookmark({
    id: 'b',
    profileId: 'default',
    songId: 's',
    name: 'Bars 1–4',
    config: saved,
    createdAt: 1,
    updatedAt: 1,
  })

  it('keeps an automatic name in step with the settings', () => {
    const edited = editBookmark(auto, { config: { ...saved, tempoPercent: 80 } }, 5)
    expect(edited).toMatchObject({
      autoName: true,
      name: 'Bars 1–4 · 80% · both hands · pre-roll 2',
      updatedAt: 5,
    })
  })

  it('makes a typed name custom, and the reset makes it automatic again', () => {
    const named = editBookmark(auto, { name: '  Opening ' }, 2)
    expect(named).toMatchObject({ autoName: false, name: 'Opening' })
    const changed = editBookmark(named, { config: { ...saved, preRollBeats: 0 } }, 3)
    expect(changed.name).toBe('Opening')
    expect(editBookmark(changed, { autoName: true }, 4)).toMatchObject({
      autoName: true,
      name: 'Bars 1–4 · 100% · both hands · no pre-roll',
    })
    // An emptied name keeps the old one.
    expect(editBookmark(named, { name: '  ' }, 5).name).toBe('Opening')
  })
})

describe('tempoSliderRange', () => {
  it('keeps 100% on the grid for every step, inside 25–200%', () => {
    expect(tempoSliderRange(5)).toEqual({ min: 25, max: 200, step: 5 })
    expect(tempoSliderRange(1)).toEqual({ min: 25, max: 200, step: 1 })
    expect(tempoSliderRange(3)).toEqual({ min: 25, max: 199, step: 3 })
    expect(tempoSliderRange(4)).toEqual({ min: 28, max: 200, step: 4 })
    expect(tempoSliderRange(7)).toEqual({ min: 30, max: 198, step: 7 })
    for (let step = 1; step <= 10; step++) {
      const { min, max } = tempoSliderRange(step)
      expect((100 - min) % step).toBe(0)
      expect(min).toBeGreaterThanOrEqual(25)
      expect(max).toBeLessThanOrEqual(200)
    }
  })
})

describe('quiet pre-roll in names', () => {
  it('names a quiet pre-roll; muted stays implicit; no beats is "no pre-roll"', () => {
    expect(autoBookmarkName({ ...saved, preRollMode: 'quiet' })).toBe(
      'Bars 1–4 · 100% · both hands · quiet pre-roll 2',
    )
    expect(autoBookmarkName({ ...saved, preRollMode: 'quiet', preRollBeats: 0 })).toBe(
      'Bars 1–4 · 100% · both hands · no pre-roll',
    )
    expect(bookmarkSummary({ ...saved, preRollMode: 'quiet' }, 64)).toBe(
      'Bars 1–4 · 100% · quiet pre-roll 2',
    )
  })

  it('settles an old auto-named bookmark with a quiet pre-roll to the new name', () => {
    const settled = settleBookmark({
      id: 'b',
      profileId: 'default',
      songId: 's',
      name: 'Bars 1–4',
      config: { ...saved, preRollMode: 'quiet' },
      createdAt: 1,
      updatedAt: 1,
    })
    expect(settled).toMatchObject({
      autoName: true,
      name: 'Bars 1–4 · 100% · both hands · quiet pre-roll 2',
    })
  })

  it('only the pre-roll sound differing still makes two bookmarks different', () => {
    const quiet = { songId: 's', config: { ...saved, preRollMode: 'quiet' as const } }
    expect(sameBookmarkSettings({ songId: 's', config: saved }, quiet)).toBe(false)
    expect(sameBookmarkSettings(quiet, { songId: 's', config: { ...quiet.config } })).toBe(true)
  })
})

describe('metronome per bookmark (decision 61)', () => {
  it('names the metronome only when on, and counts it as a setting', () => {
    expect(autoBookmarkName({ ...saved, metronomeMode: 'always' })).toBe(
      'Bars 1–4 · 100% · both hands · pre-roll 2 · metronome',
    )
    expect(autoBookmarkName({ ...saved, metronomeMode: 'preRoll' })).toBe(
      'Bars 1–4 · 100% · both hands · pre-roll 2 · metronome in pre-roll',
    )
    expect(bookmarkSummary({ ...saved, metronomeMode: 'always' }, 64)).toBe(
      'Bars 1–4 · 100% · pre-roll 2 · metronome',
    )
    const a = { songId: 's', config: saved }
    expect(
      sameBookmarkSettings(a, { songId: 's', config: { ...saved, metronomeMode: 'always' } }),
    ).toBe(false)
    expect(diffFromBookmark(saved, { ...saved, metronomeMode: 'preRoll' })).toEqual([
      'metronomeMode',
    ])
  })

  it('Full song uses the Audio setting; a stored bookmark without a mode is off', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      audio: { ...DEFAULT_SETTINGS.audio, metronomeMode: 'always' as const },
    }
    expect(fullSongConfig(settings).metronomeMode).toBe('always')
    expect(newBookmarkConfig(settings, 64).metronomeMode).toBe('off')
    const { metronomeMode: _, ...older } = saved
    const settled = settleBookmark({
      id: 'b',
      profileId: 'default',
      songId: 's',
      name: 'Opening',
      config: older,
      createdAt: 1,
      updatedAt: 1,
    })
    expect(settled.config.metronomeMode).toBe('off')
    expect(settled.autoName).toBe(false)
  })
})
