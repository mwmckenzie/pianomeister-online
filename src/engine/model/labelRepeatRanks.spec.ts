// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BAR_START, labelRepeatRanks, RUN_START } from './labelRepeatRanks'

const BEAT = 480
/** 4/4: a bar every four beats. */
const barOf = (tick: number) => Math.floor(tick / (4 * BEAT)) + 1
const note = (midi: number, startTick: number, endTick = startTick + 100) => ({
  midi,
  startTick,
  endTick,
})
const ranks = (notes: ReturnType<typeof note>[]) => [...labelRepeatRanks(notes, BEAT, barOf)]

describe('labelRepeatRanks', () => {
  it('ranks the first of repeated notes as the run start, the rest 0 within a bar', () => {
    expect(ranks([0, 120, 240, 360].map((t) => note(69, t)))).toEqual([RUN_START, 0, 0, 0])
  })

  it('marks the first note of the run in each later bar', () => {
    // Quarters across three bars: bar 1 starts the run, bars 2 and 3 each get one.
    const run = Array.from({ length: 12 }, (_, k) => note(69, k * BEAT))
    const r = ranks(run)
    expect(r[0]).toBe(RUN_START)
    expect(r[4]).toBe(BAR_START)
    expect(r[8]).toBe(BAR_START)
    expect(r.filter((x) => x === 0)).toHaveLength(9)
  })

  it('starts a new run after a gap of more than a beat', () => {
    expect(ranks([note(69, 0), note(69, 480), note(69, 1061)])).toEqual([RUN_START, 0, RUN_START])
  })

  it('a gap of exactly a beat keeps the run', () => {
    expect(ranks([note(69, 0, 100), note(69, 580)])).toEqual([RUN_START, 0])
  })

  it('keeps pitches apart: each lane has its own runs', () => {
    const notes = [note(69, 0), note(71, 0), note(69, 120), note(71, 120), note(72, 120)]
    expect(ranks(notes)).toEqual([RUN_START, RUN_START, 0, 0, RUN_START])
  })

  it('does not depend on input order', () => {
    expect(ranks([note(69, 240), note(69, 0), note(69, 120)])).toEqual([0, RUN_START, 0])
  })
})
