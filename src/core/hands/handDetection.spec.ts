// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { demoCombined, demoMidi, demoSeparate } from '../testing/handDemos'
import { computeVoiceStats } from './computeVoiceStats'
import { detectHands } from './detectHands'
import { extractNotes } from './extractNotes'
import { initialRoles } from './initialRoles'
import { songConfidence } from './songConfidence'
import type { VoiceStats } from './VoiceStats'

const voice = (track: number, medianPitch: number, over: Partial<VoiceStats> = {}): VoiceStats => ({
  id: `${track}:${over.channel ?? 0}`,
  track,
  channel: 0,
  trackName: '',
  program: 0,
  noteCount: 100,
  minPitch: medianPitch - 5,
  maxPitch: medianPitch + 5,
  meanPitch: medianPitch,
  medianPitch,
  p10: medianPitch - 4,
  p90: medianPitch + 4,
  avgPolyphony: 1,
  maxPolyphony: 1,
  wideSpanRatio: 0,
  histogramGap: 0,
  ...over,
})
const of = (stats: readonly VoiceStats[]) => {
  const d = detectHands(stats)
  return { ...d, conf: d.guesses.map((g) => g.confidence), roles: d.guesses.map((g) => g.role) }
}
const DEFAULT = { right: [0], left: [1] }

describe('extractNotes', () => {
  const on = (tick: number, note: number, velocity = 80) =>
    ({ kind: 'noteOn', tick, channel: 0, note, velocity }) as const
  const off = (tick: number, note: number) =>
    ({ kind: 'noteOff', tick, channel: 0, note, velocity: 0 }) as const

  it('gives ids that count every event of the track', () => {
    const notes = extractNotes(
      demoMidi.file([[], [demoMidi.name('x'), on(0, 60), off(10, 60), on(10, 62), on(20, 62, 0)]]),
    )
    expect(notes.map((n) => [n.id, n.endTick, n.offIndex])).toEqual([
      ['1:1', 10, 2],
      ['1:3', 20, 4],
    ])
  })

  it('closes overlapping notes of one pitch first in, first out', () => {
    const notes = extractNotes(demoMidi.file([[on(0, 60), on(5, 60), off(10, 60), off(30, 60)]]))
    expect(notes.map((n) => [n.startTick, n.endTick])).toEqual([
      [0, 10],
      [5, 30],
    ])
  })

  it('ends a note never released at the last tick of its track', () => {
    const notes = extractNotes(
      demoMidi.file([[on(0, 60), on(100, 64), off(200, 64)], [on(900, 70)]]),
    )
    expect(notes.map((n) => [n.endTick, n.offIndex])).toEqual([
      [200, -1],
      [200, 2],
      [901, -1],
    ])
  })
})

describe('voice detection', () => {
  it('finds separate hands by name and pitch (criterion 1)', () => {
    const file = demoSeparate()
    const d = detectHands(computeVoiceStats(file, extractNotes(file)))
    expect([d.right, d.left]).toEqual(['1:5', '2:2'])
    expect(d.summary).toBe(
      'Hands look separate already: right hand is track 1 ch 5 ("Piano RH"), left hand is track 2 ch 2 ("Piano LH").',
    )
  })

  it('reports a combined voice (criterion 2)', () => {
    const file = demoCombined()
    const d = detectHands(computeVoiceStats(file, extractNotes(file)))
    expect(d.combined).toEqual(['1:3'])
    expect(d.summary).toBe(
      'Both hands appear to share track 1 ch 3 ("Piano"). Pick a split algorithm below.',
    )
  })

  it('tells two tracks on one channel apart (criterion 3)', () => {
    const d = of([voice(1, 72), voice(2, 50)])
    expect([d.right, d.left]).toEqual(['1:0', '2:0'])
  })

  it('gives every guess a confidence and a reason (criterion 4)', () => {
    const d = of([
      voice(1, 72),
      voice(2, 50),
      voice(3, 60),
      voice(4, 40, { noteCount: 3 }),
      voice(5, 40, { channel: 9 }),
      voice(6, 60, { wideSpanRatio: 0.9 }),
    ])
    for (const g of d.guesses) {
      expect(g.confidence).toBeGreaterThanOrEqual(0)
      expect(g.confidence).toBeLessThanOrEqual(1)
      expect(g.reasons.length).toBeGreaterThan(0)
    }
    expect(d.roles).toEqual(['right', 'left', 'other', 'other', 'drums', 'both'])
    expect(d.guesses[3]?.reasons).toEqual(['Only 3 notes'])
    expect(d.guesses[4]?.reasons).toEqual(['Channel 9 is the GM drum channel'])
  })

  it('computes confidences as the brief does (criterion 5)', () => {
    expect(of([voice(1, 60), voice(2, 60)]).conf[0]).toBeCloseTo(0.4)
    expect(of([voice(1, 72), voice(2, 60)]).conf).toEqual([0.8, 0.8])
    expect(of([voice(1, 90), voice(2, 40)]).conf).toEqual([0.9, 0.9])
    const named = of([voice(1, 61, { trackName: 'Right' }), voice(2, 60, { trackName: 'Left' })])
    expect(named.conf).toEqual([0.85, 0.85])
    const strings = of([voice(1, 72, { program: 48 }), voice(2, 60, { program: 48 })])
    expect(strings.conf[0]).toBeCloseTo(0.8 * 0.7)
    expect(of([voice(1, 60)]).conf).toEqual([0.3])
  })

  it('scores both hands as the brief does, capped at 95 %', () => {
    const both = voice(1, 60, {
      wideSpanRatio: 0.5,
      p10: 40,
      p90: 80,
      histogramGap: 9,
      avgPolyphony: 3,
    })
    expect(of([both])).toMatchObject({ conf: [0.95], roles: ['both'] })
    expect(of([both]).guesses[0]?.reasons).toEqual([
      '50% of onsets span more than one hand can reach',
      'Wide core range (40 semitones between 10th and 90th percentile)',
      'Pitch histogram has a 9-semitone hole, suggesting two registers',
      'Dense texture (avg 3.0 notes sounding)',
    ])
    expect(of([voice(1, 60, { wideSpanRatio: 0.7, trackName: 'RH' })]).roles).toEqual(['right'])
  })

  it('lets names win over pitch, and never swaps them', () => {
    const d = of([voice(1, 50, { trackName: 'Right' }), voice(2, 70, { trackName: 'Left' })])
    expect([d.right, d.left]).toEqual(['1:0', '2:0'])
  })
})

describe('initial roles', () => {
  const roles = (stats: readonly VoiceStats[], defaults = DEFAULT) =>
    initialRoles(detectHands(stats), stats, defaults)

  it('splits a lone voice, unless its name says which hand it is', () => {
    expect(roles([voice(1, 60)])).toEqual({ '1:0': 'split' })
    expect(roles([voice(1, 60, { trackName: 'Right hand' })])).toEqual({ '1:0': 'right' })
    expect(roles([voice(1, 60, { trackName: 'Left hand' })])).toEqual({ '1:0': 'left' })
  })

  it('never hides what the default map plays: other voices keep its role', () => {
    const stats = [
      voice(1, 72),
      voice(2, 50),
      voice(3, 60),
      voice(4, 60, { channel: 1, noteCount: 3 }),
      voice(5, 60, { channel: 5, noteCount: 3 }),
    ]
    expect(roles(stats)).toEqual({
      '1:0': 'right',
      '2:0': 'left',
      '3:0': 'right',
      '4:1': 'left',
      '5:5': 'hidden',
    })
  })

  it('keeps drums hidden unless the default map plays channel 9', () => {
    const stats = [voice(1, 60, { channel: 9 })]
    expect(roles(stats)).toEqual({ '1:9': 'hidden' })
    expect(roles(stats, { right: [9], left: [] })).toEqual({ '1:9': 'right' })
  })
})

describe('song confidence', () => {
  it('is the lowest among the hands detection found', () => {
    const stats = [voice(1, 72), voice(2, 60, { program: 48 }), voice(3, 60, { noteCount: 2 })]
    const d = detectHands(stats)
    expect(songConfidence(d, {})).toBeCloseTo(0.56)
  })

  it('falls back to the shown voices, and is null when nothing is shown', () => {
    const d = detectHands([voice(1, 60, { noteCount: 4 })])
    expect(songConfidence(d, { '1:0': 'right' })).toBe(0.5)
    expect(songConfidence(d, { '1:0': 'hidden' })).toBeNull()
  })
})
