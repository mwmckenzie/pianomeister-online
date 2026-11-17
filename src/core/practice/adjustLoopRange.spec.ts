// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { adjustLoopRange } from './adjustLoopRange'

const range = { start: 5, end: 8 }

describe('adjustLoopRange', () => {
  it('applies a change that keeps the range valid', () => {
    expect(adjustLoopRange(range, { start: 3 }, 1, 20)).toEqual({ start: 3, end: 8 })
    expect(adjustLoopRange(range, { end: 12 }, 1, 20)).toEqual({ start: 5, end: 12 })
  })

  it('pulls the end along when the start moves past it', () => {
    expect(adjustLoopRange(range, { start: 10 }, 1, 20)).toEqual({ start: 10, end: 10 })
  })

  it('pulls the start back when the end moves before it', () => {
    expect(adjustLoopRange(range, { end: 2 }, 1, 20)).toEqual({ start: 2, end: 2 })
  })

  it('allows a one-bar loop', () => {
    expect(adjustLoopRange(range, { end: 5 }, 1, 20)).toEqual({ start: 5, end: 5 })
  })

  it('clamps both ends to the song and rounds to whole bars', () => {
    expect(adjustLoopRange(range, { start: 0 }, 1, 20)).toEqual({ start: 1, end: 8 })
    expect(adjustLoopRange(range, { end: 99 }, 1, 20)).toEqual({ start: 5, end: 20 })
    expect(adjustLoopRange(range, { start: 99 }, 1, 20)).toEqual({ start: 20, end: 20 })
    expect(adjustLoopRange(range, { start: 6.6 }, 1, 20)).toEqual({ start: 7, end: 8 })
    expect(adjustLoopRange(range, { end: Number.NaN }, 1, 20)).toEqual({ start: 1, end: 1 })
  })

  it('repairs a stored range that was already out of bounds', () => {
    expect(adjustLoopRange({ start: 5, end: 40 }, { start: 6 }, 1, 20)).toEqual({
      start: 6,
      end: 20,
    })
  })
})
