import { describe, expect, it } from 'vitest'

import { nudgeLoop } from './nudgeLoop'

describe('nudgeLoop', () => {
  const range = { start: 5, end: 8 }

  it('moves one end by a bar', () => {
    expect(nudgeLoop(range, 'start', -1, 1, 20)).toEqual({ start: 4, end: 8 })
    expect(nudgeLoop(range, 'start', 1, 1, 20)).toEqual({ start: 6, end: 8 })
    expect(nudgeLoop(range, 'end', -1, 1, 20)).toEqual({ start: 5, end: 7 })
    expect(nudgeLoop(range, 'end', 1, 1, 20)).toEqual({ start: 5, end: 9 })
  })

  it('pushes the other end instead of making the range invalid', () => {
    const oneBar = { start: 5, end: 5 }
    expect(nudgeLoop(oneBar, 'start', 1, 1, 20)).toEqual({ start: 6, end: 6 })
    expect(nudgeLoop(oneBar, 'end', -1, 1, 20)).toEqual({ start: 4, end: 4 })
  })

  it('stays within the song', () => {
    expect(nudgeLoop({ start: 1, end: 4 }, 'start', -1, 1, 20)).toEqual({ start: 1, end: 4 })
    expect(nudgeLoop({ start: 17, end: 20 }, 'end', 1, 1, 20)).toEqual({ start: 17, end: 20 })
    expect(nudgeLoop({ start: 20, end: 20 }, 'start', 1, 1, 20)).toEqual({ start: 20, end: 20 })
  })

  it('adds up: four nudges move four bars', () => {
    let r: { readonly start: number; readonly end: number } = range
    for (let i = 0; i < 4; i++) r = nudgeLoop(r, 'end', 1, 1, 20)
    expect(r).toEqual({ start: 5, end: 12 })
    for (let i = 0; i < 4; i++) r = nudgeLoop(r, 'start', 1, 1, 20)
    expect(r).toEqual({ start: 9, end: 12 })
  })
})
