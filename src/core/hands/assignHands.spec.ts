// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { Note } from '../song/Note'
import { assignHands } from './assignHands'
import { DEFAULT_HAND_ASSIGNMENT } from './HandAssignment'

const note = (channel: number, startTick = 0): Note => ({
  midi: 60,
  channel,
  startTick,
  endTick: startTick + 10,
  velocity: 90,
})

describe('assignHands', () => {
  it('defaults to channel 0 = right, channel 1 = left, and drops other channels', () => {
    const tagged = assignHands([note(0), note(1), note(2)], DEFAULT_HAND_ASSIGNMENT)
    expect(tagged.map((n) => [n.channel, n.hand])).toEqual([
      [0, 'right'],
      [1, 'left'],
    ])
  })

  it('supports several channels per hand and keeps note order', () => {
    const tagged = assignHands([note(3, 0), note(0, 5), note(2, 9)], { right: [2, 3], left: [0] })
    expect(tagged.map((n) => [n.channel, n.hand])).toEqual([
      [3, 'right'],
      [0, 'left'],
      [2, 'right'],
    ])
  })

  it('gives a channel listed under both hands to the right hand', () => {
    expect(assignHands([note(0)], { right: [0], left: [0] })[0]?.hand).toBe('right')
  })

  it('drops everything when no channel is assigned', () => {
    expect(assignHands([note(0), note(1)], { right: [], left: [] })).toEqual([])
  })
})
