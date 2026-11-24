// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readMidiFile } from '../midi/readMidiFile'
import { writeMidiFile } from '../midi/writeMidiFile'
import { demoCombined, demoMidi } from '../testing/handDemos'
import { applyFlips } from './applyFlips'
import { beamSplit } from './beamSplit'
import { exportFileName } from './exportFileName'
import { exportSongHands } from './exportSongHands'
import { exportWarnings } from './exportWarnings'
import { extractNotes } from './extractNotes'
import { flipNote } from './flipNote'
import { noteAt } from './noteAt'
import { resolveSongHands } from './resolveSongHands'
import { reviewSongHands } from './reviewSongHands'
import { setSplitParam } from './setSplitParam'

const settings = { roles: { '1:3': 'split' as const }, algorithm: 'beam', params: {}, flips: {} }

describe('review edits', () => {
  it('flips a note, and flipping back removes the flip', () => {
    const once = flipNote({}, 'a', 'R')
    expect(once).toEqual({ a: 'L' })
    expect(flipNote(once, 'a', 'R')).toEqual({})
    expect(flipNote({ b: 'R' }, 'a', 'L')).toEqual({ b: 'R', a: 'R' })
    // The method now agrees with an old flip: flipping turns the note away from both.
    expect(flipNote({ a: 'L' }, 'a', 'L')).toEqual({ a: 'R' })
  })

  it('keeps only parameters that differ from the default', () => {
    const changed = setSplitParam(beamSplit, {}, 'reach', 14)
    expect(changed).toEqual({ reach: 14 })
    expect(setSplitParam(beamSplit, changed, 'reach', 12)).toEqual({})
  })

  it('applies flips as saving does, and never shows a Hidden note', () => {
    expect(applyFlips(['a', 'b', 'c'], 'RL-', { a: 'L', c: 'R' })).toBe('LL-')
    const bytes = writeMidiFile(demoCombined())
    const ids = extractNotes(readMidiFile(bytes)).map((n) => n.id)
    const { computed } = reviewSongHands(bytes, settings)
    const flips = flipNote({}, ids[3] ?? '', computed[3] === 'R' ? 'R' : 'L')
    expect(applyFlips(ids, computed, flips)).toBe(
      resolveSongHands(bytes, { ...settings, flips }).hands,
    )
  })

  it('hits the note under the pointer, or a thin one nearby', () => {
    const box = (index: number, y: number) => ({ index, x: 10, y, width: 20, height: 4 })
    const boxes = [box(0, 10), box(1, 14)]
    expect(noteAt(boxes, 15, 12)).toBe(0)
    expect(noteAt(boxes, 15, 15)).toBe(1)
    expect(noteAt(boxes, 32, 16)).toBe(1)
    expect(noteAt(boxes, 15, 40)).toBeNull()
  })
})

describe('export', () => {
  it('warns about equal channels and hidden voices on a hand’s channel', () => {
    const voices = [
      { id: '1:0', track: 1, channel: 0 },
      { id: '3:1', track: 3, channel: 1 },
    ]
    const roles = { '1:0': 'split', '3:1': 'hidden' } as const
    const warn = (rightChannel: number, leftChannel: number) =>
      exportWarnings(voices, roles, { rightChannel, leftChannel })
    expect(warn(0, 2)).toEqual([])
    expect(warn(0, 1)).toEqual(['Track 3 · ch 1 would mix with the left hand'])
    expect(warn(1, 1)).toEqual([
      'Both hands would be on channel 1',
      'Track 3 · ch 1 would mix with both hands',
    ])
  })

  it.each(['inPlace', 'twoTracks'] as const)('round-trips %s, flips included', (layout) => {
    const bytes = writeMidiFile(demoCombined())
    const before = extractNotes(readMidiFile(bytes))
    const { computed } = reviewSongHands(bytes, settings)
    const at = computed.indexOf('R')
    const flips = { [before[at]?.id ?? '']: 'L' as const }
    const out = exportSongHands(
      bytes,
      { ...settings, flips },
      { rightChannel: 4, leftChannel: 7, layout },
    )
    const after = extractNotes(readMidiFile(out))
    expect(after).toHaveLength(before.length)
    const left = after.filter((n) => n.channel === 7)
    expect(new Set(after.map((n) => n.channel))).toEqual(new Set([4, 7]))
    expect(left).toHaveLength([...computed].filter((h) => h === 'L').length + 1)
    const key = (n: { startTick: number; endTick: number; midi: number }) =>
      `${n.startTick}-${n.endTick}-${n.midi}`
    expect(after.map(key).sort()).toEqual(before.map(key).sort())
  })

  it('leaves hidden voices unchanged', () => {
    const file = demoMidi.file([
      demoMidi.notes([{ midi: 60, start: 0, length: 100 }], 0),
      demoMidi.notes([{ midi: 40, start: 0, length: 100 }], 6),
    ])
    const out = exportSongHands(
      writeMidiFile(file),
      { ...settings, roles: { '0:0': 'left', '1:6': 'hidden' } },
      { rightChannel: 0, leftChannel: 1, layout: 'twoTracks' },
    )
    expect(extractNotes(readMidiFile(out)).map((n) => [n.midi, n.channel, n.track])).toEqual([
      [40, 6, 1],
      [60, 1, 3],
    ])
  })

  it('names the file after the song', () => {
    expect(exportFileName('Für Elise')).toBe('Für Elise (hands).mid')
    expect(exportFileName('A/B: "C"?')).toBe('A-B- -C-- (hands).mid')
    expect(exportFileName(' ')).toBe('Song (hands).mid')
  })
})
