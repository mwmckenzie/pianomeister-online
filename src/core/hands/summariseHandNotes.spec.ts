// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { summariseHandNotes } from './summariseHandNotes'

const ch = (channel: number, noteCount: number, minPitch: number, maxPitch: number) => ({
  channel,
  noteCount,
  minPitch,
  maxPitch,
  averagePitch: (minPitch + maxPitch) / 2,
})

describe('summariseHandNotes', () => {
  it('counts notes per hand and spans both hands', () => {
    const channels = [ch(0, 258, 60, 84), ch(1, 150, 36, 59)]
    expect(summariseHandNotes(channels, { right: [0], left: [1] })).toEqual({
      right: 258,
      left: 150,
      lowest: 36,
      highest: 84,
    })
  })

  it('leaves hidden channels out and counts a shared channel for the right hand', () => {
    const channels = [ch(0, 10, 60, 72), ch(1, 20, 40, 50), ch(2, 5, 20, 100)]
    expect(summariseHandNotes(channels, { right: [0, 1], left: [1] })).toEqual({
      right: 30,
      left: 0,
      lowest: 40,
      highest: 72,
    })
  })

  it('has no range when nothing plays', () => {
    expect(summariseHandNotes([], { right: [0], left: [1] })).toEqual({
      right: 0,
      left: 0,
      lowest: null,
      highest: null,
    })
  })
})
