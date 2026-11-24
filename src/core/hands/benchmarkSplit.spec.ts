// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { MidiEvent } from '../midi/MidiEvent'
import { writeMidiFile } from '../midi/writeMidiFile'
import { demoMidi, demoSeparate } from '../testing/handDemos'
import { benchmarkSplit } from './benchmarkSplit'
import { fixedSplit } from './fixedSplit'
import type { SplitAlgorithm } from './SplitAlgorithm'
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
    const run = {
      notes: 3,
      seconds: 1,
      startBar: 1,
      startSeconds: 0.5,
      rightGivenLeft: 3,
      leftGivenRight: 0,
    }
    expect(benchmarkSplit(bytes, [fixedSplit], {}, now)?.scores).toEqual([
      {
        algorithm: 'fixed',
        correct: 3,
        longestRun: run,
        longestTime: run,
        uncertain: 0,
        uncertainWrong: 0,
        ms: 0,
      },
    ])
    expect(
      benchmarkSplit(bytes, [fixedSplit], { fixed: { split: 45 } }, now)?.scores[0]?.correct,
    ).toBe(7)
  })

  it('locates a run by the file’s meter, tells a swap, and scores the uncertain notes', () => {
    const meter: MidiEvent = {
      kind: 'meta',
      tick: 0,
      metaType: 0x58,
      data: new Uint8Array([3, 2, 24, 8]),
    }
    // In 3/4: the hands change places in bar 2, then go back.
    const file = demoMidi.file([
      [demoMidi.name('right'), meter, ...demoMidi.notes(line([72, 72, 72, 50, 50, 50, 72]), 0)],
      [demoMidi.name('left'), ...demoMidi.notes(line([40, 40, 40, 70, 70, 70, 40]), 0)],
    ])
    // Marks both notes of the second beat (right) and of the fourth (wrong).
    const marking: SplitAlgorithm = {
      ...fixedSplit,
      run: (notes, params, context) => ({
        ...fixedSplit.run(notes, params, context),
        uncertain: new Set(
          notes.filter((n) => n.startTick === 480 || n.startTick === 1440).map((n) => n.id),
        ),
      }),
    }
    const score = benchmarkSplit(writeMidiFile(file), [marking], {}, now)?.scores[0]
    expect(score?.longestRun).toEqual({
      notes: 6,
      seconds: 1,
      startBar: 2,
      startSeconds: 1.5,
      rightGivenLeft: 3,
      leftGivenRight: 3,
    })
    expect(score).toMatchObject({ correct: 8, uncertain: 4, uncertainWrong: 2 })
  })

  it('counts notes never released, and refuses files without both hands', () => {
    const open: MidiEvent = { kind: 'noteOn', tick: 0, channel: 0, note: 72, velocity: 80 }
    const left = [demoMidi.name('left'), ...demoMidi.notes(line([40]), 0)]
    const both = writeMidiFile(demoMidi.file([[demoMidi.name('right'), open], left]))
    expect(benchmarkSplit(both, [fixedSplit], {}, now)?.unreleased).toBe(1)
    expect(benchmarkSplit(writeMidiFile(demoMidi.file([left])), [fixedSplit], {}, now)).toBeNull()
  })
})
