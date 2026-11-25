// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { mulberry32 } from '@/core/bench/mulberry32'

import { BUCKET, NoteSpans, type TickWindow } from './NoteSpans'

interface Span {
  readonly startTick: number
  readonly endTick: number
}

const span = (startTick: number, endTick: number): Span => ({ startTick, endTick })
const every = (n: number, step: number, length: number) =>
  Array.from({ length: n }, (_, i) => span(i * step, i * step + length))

/** Notes the window shows, by the plain rule. */
function shown(notes: readonly Span[], w: TickWindow): number[] {
  return notes.flatMap((n, i) =>
    n.endTick > w.from && n.startTick < w.to && n.startTick >= (w.startFrom ?? -Infinity)
      ? [i]
      : [],
  )
}

describe('NoteSpans', () => {
  it('covers every shown note of random songs, in both orders', () => {
    const rand = mulberry32(7)
    let missing = 0
    for (let song = 0; song < 60; song++) {
      const n = Math.floor(rand() * 200)
      const ascending = Array.from({ length: n }, () => {
        const start = Math.floor(rand() * 60) * 120
        // Some drones, some zero-length notes.
        return span(start, start + (rand() < 0.05 ? 4000 : Math.floor(rand() * 500)))
      }).sort((a, b) => a.startTick - b.startTick)
      for (const descending of [false, true]) {
        const notes = descending
          ? [...ascending].sort((a, b) => b.startTick - a.startTick)
          : ascending
        const spans = new NoteSpans(notes, descending)
        for (let k = 0; k < 40; k++) {
          const from = rand() * 9000 - 1000
          const w: TickWindow = {
            from,
            to: from + rand() * 2500,
            ...(rand() < 0.3 ? { startFrom: from - rand() * 1000 } : {}),
          }
          const { first, count } = spans.range(w)
          missing += shown(notes, w).filter((i) => i < first || i >= first + count).length
          expect(first).toBeGreaterThanOrEqual(0)
          expect(first + count).toBeLessThanOrEqual(n)
        }
      }
    }
    expect(missing).toBe(0)
  })

  it('reaches a whole bucket beyond the window on both sides, and starts on bucket edges', () => {
    const { first, count } = new NoteSpans(every(400, 10, 10), false).range({
      from: 1000,
      to: 2000,
    })
    expect(first % BUCKET).toBe(0)
    expect(100 - first).toBeGreaterThanOrEqual(BUCKET)
    expect(first + count - 200).toBeGreaterThanOrEqual(BUCKET)
    expect(count).toBeLessThan(100 + 4 * BUCKET)
  })

  it('says which windows have the same range', () => {
    const rand = mulberry32(3)
    const notes = every(300, 10, 35)
    const spans = new NoteSpans(notes, false)
    for (let k = 0; k < 400; k++) {
      const from = rand() * 3400 - 200
      const w = { from, to: from + rand() * 600 }
      const b = spans.bounds(w)
      const inside = {
        from: Math.max(b.from, from - rand() * 10),
        to: Math.min(b.to, w.to + rand() * 10),
      }
      if (inside.from < b.fromEnd && inside.to > b.toStart) {
        expect(spans.range(inside)).toEqual(spans.range(w))
      }
    }
  })

  it('keeps a drone that started long ago', () => {
    const spans = new NoteSpans([span(0, 100_000), ...every(400, 10, 10)], false)
    expect(spans.range({ from: 3000, to: 3500 }).first).toBe(0)
  })

  it('is empty before, after and without notes', () => {
    const spans = new NoteSpans(every(50, 10, 10), true)
    expect(spans.range({ from: -900, to: -100 }).count).toBe(0)
    expect(spans.range({ from: 9000, to: 9900 }).count).toBe(0)
    expect(new NoteSpans([], false).range({ from: 0, to: 100 }).count).toBe(0)
  })
})
