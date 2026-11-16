// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { ChannelInfo } from '../song/ChannelInfo'
import { defaultHands } from './defaultHands'
import { DEFAULT_HAND_ASSIGNMENT } from './HandAssignment'

const ch = (channel: number, averagePitch: number): ChannelInfo => ({
  channel,
  noteCount: 10,
  minPitch: averagePitch - 5,
  maxPitch: averagePitch + 5,
  averagePitch,
})

describe('defaultHands', () => {
  it('keeps channel 0 = right, 1 = left when either has notes', () => {
    expect(defaultHands([ch(0, 70), ch(1, 50)])).toEqual(DEFAULT_HAND_ASSIGNMENT)
    expect(defaultHands([ch(1, 50), ch(5, 80)])).toEqual(DEFAULT_HAND_ASSIGNMENT)
  })

  it('otherwise picks by average pitch and hides the rest', () => {
    expect(defaultHands([ch(2, 48), ch(3, 72), ch(9, 60)])).toEqual({ right: [3], left: [9] })
  })

  it('gives a single channel to the right hand', () => {
    expect(defaultHands([ch(4, 60)])).toEqual({ right: [4], left: [] })
  })

  it('handles a song without notes', () => {
    expect(defaultHands([])).toEqual({ right: [], left: [] })
  })
})
