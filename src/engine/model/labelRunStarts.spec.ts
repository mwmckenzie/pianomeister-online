// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { labelRunStarts } from './labelRunStarts'

const BEAT = 480
const note = (midi: number, startTick: number, endTick = startTick + 100) => ({
  midi,
  startTick,
  endTick,
})

describe('labelRunStarts', () => {
  it('labels only the first of repeated notes', () => {
    const run = [0, 120, 240, 360].map((t) => note(69, t))
    expect([...labelRunStarts(run, BEAT)]).toEqual([1, 0, 0, 0])
  })

  it('starts a new run after a gap of more than a beat', () => {
    // Gaps: 380 (within a beat), then 481 (over).
    expect([...labelRunStarts([note(69, 0), note(69, 480), note(69, 1061)], BEAT)]).toEqual([
      1, 0, 1,
    ])
  })

  it('a gap of exactly a beat keeps the run', () => {
    expect([...labelRunStarts([note(69, 0, 100), note(69, 580)], BEAT)]).toEqual([1, 0])
  })

  it('keeps pitches apart: each lane has its own runs', () => {
    const notes = [note(69, 0), note(71, 0), note(69, 120), note(71, 120), note(72, 120)]
    expect([...labelRunStarts(notes, BEAT)]).toEqual([1, 1, 0, 0, 1])
  })

  it('does not depend on input order', () => {
    expect([...labelRunStarts([note(69, 240), note(69, 0), note(69, 120)], BEAT)]).toEqual([
      0, 1, 0,
    ])
  })
})
