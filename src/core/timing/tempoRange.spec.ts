// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { tempoRange } from './tempoRange'

const PPQ = 480
const at = (tick: number, bpm: number) => ({ tick, microsPerQuarter: 60e6 / bpm })
/** Ticks lasting `seconds` at `bpm`. */
const ticksFor = (seconds: number, bpm: number) => Math.round((seconds * bpm * PPQ) / 60)

describe('tempoRange', () => {
  it('is one value for a constant tempo, including no events (120)', () => {
    expect(tempoRange([at(0, 126)], 1000, PPQ)).toEqual({ min: 126, max: 126 })
    expect(tempoRange([], 1000, PPQ)).toEqual({ min: 120, max: 120 })
  })

  it('spans tempos that each play a real share of the song', () => {
    // 40 s at 120, 30 s at 126, 30 s at 100.
    const a = ticksFor(40, 120)
    const b = a + ticksFor(30, 126)
    const end = b + ticksFor(30, 100)
    expect(tempoRange([at(0, 120), at(a, 126), at(b, 100)], end, PPQ)).toEqual({
      min: 100,
      max: 126,
    })
  })

  it('ignores a closing ritardando shorter than 5% of the song time', () => {
    // 95 s at 100, then 4 s at 50: the slowdown is ~4% of the time.
    const a = ticksFor(95, 100)
    const end = a + ticksFor(4, 50)
    expect(tempoRange([at(0, 100), at(a, 50)], end, PPQ)).toEqual({ min: 100, max: 100 })
  })

  it('ignores a short fast pickup at the start', () => {
    const a = ticksFor(2, 160)
    const end = a + ticksFor(98, 90)
    expect(tempoRange([at(0, 160), at(a, 90)], end, PPQ)).toEqual({ min: 90, max: 90 })
  })

  it('keeps a slowdown longer than 5% of the song time', () => {
    const a = ticksFor(90, 100)
    const end = a + ticksFor(10, 50)
    expect(tempoRange([at(0, 100), at(a, 50)], end, PPQ)).toEqual({ min: 50, max: 100 })
  })

  it('weights by seconds, not ticks', () => {
    // Equal ticks at 50 and 200 bpm: 50 bpm takes 4× the time, so 200 still counts (20%).
    const half = 9600
    expect(tempoRange([at(0, 50), at(half, 200)], 2 * half, PPQ)).toEqual({ min: 50, max: 200 })
  })

  it('uses 120 before a single event that starts after tick 0', () => {
    expect(tempoRange([at(480, 90)], 960, PPQ)).toEqual({ min: 90, max: 120 })
  })

  it('ignores events at or after the end and earlier duplicates on one tick', () => {
    expect(tempoRange([at(0, 80), at(0, 100), at(2000, 40)], 2000, PPQ)).toEqual({
      min: 100,
      max: 100,
    })
  })

  it('keeps the start tempo of an empty song', () => {
    expect(tempoRange([at(0, 90)], 0, PPQ)).toEqual({ min: 90, max: 90 })
  })
})
