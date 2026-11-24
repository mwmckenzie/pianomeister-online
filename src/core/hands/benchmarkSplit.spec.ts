// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { MidiEvent } from '../midi/MidiEvent'
import { writeMidiFile } from '../midi/writeMidiFile'
import { demoMidi, demoSeparate } from '../testing/handDemos'
import { benchmarkSplit } from './benchmarkSplit'
import { fixedSplit } from './fixedSplit'
import { SPLIT_ALGORITHMS } from './SPLIT_ALGORITHMS'

const now = () => 0
const line = (midis: readonly number[]) =>
  midis.map((midi, i) => ({ midi, start: i * 480, length: 400 }))

describe('benchmarkSplit', () => {
  it('scores every method against the named tracks, other tracks left out', () => {
    const bytes = writeMidiFile(demoSeparate(['Rechts', 'Left hand']))
    const result = benchmarkSplit(bytes, SPLIT_ALGORITHMS, {}, now)
    expect(result?.scores.map((s) => s.algorithm)).toEqual(['beam', 'chord', 'moving', 'fixed'])
    // 79 notes in the hands; the strings track isn't one.
    expect(result?.notes).toBe(79)
    for (const s of result?.scores ?? []) expect(s.correct / 79).toBeGreaterThan(0.9)
  })

  it('finds the longest wrong run in notes and seconds, and applies overrides', () => {
    // At 120 bpm a beat is 0.5 s. Split at C4: wrong are right notes 2–4 and 6.
    const file = demoMidi.file([
      [demoMidi.name('right'), ...demoMidi.notes(line([72, 50, 51, 52, 72, 50]), 0)],
      [demoMidi.name('left'), ...demoMidi.notes([{ midi: 40, start: 4800, length: 100 }], 0)],
    ])
    const bytes = writeMidiFile(file)
    expect(benchmarkSplit(bytes, [fixedSplit], {}, now)?.scores).toEqual([
      { algorithm: 'fixed', correct: 3, wrongRun: 3, wrongSeconds: 1, ms: 0 },
    ])
    expect(
      benchmarkSplit(bytes, [fixedSplit], { fixed: { split: 45 } }, now)?.scores[0]?.correct,
    ).toBe(7)
  })

  it('counts notes never released, and refuses files without both hands', () => {
    const open: MidiEvent = { kind: 'noteOn', tick: 0, channel: 0, note: 72, velocity: 80 }
    const left = [demoMidi.name('left'), ...demoMidi.notes(line([40]), 0)]
    const both = writeMidiFile(demoMidi.file([[demoMidi.name('right'), open], left]))
    expect(benchmarkSplit(both, [fixedSplit], {}, now)?.unreleased).toBe(1)
    expect(benchmarkSplit(writeMidiFile(demoMidi.file([left])), [fixedSplit], {}, now)).toBeNull()
  })
})
