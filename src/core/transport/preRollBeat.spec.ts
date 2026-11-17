// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { preRollBeat } from './preRollBeat'

const window = { startSec: 10, endSec: 12, targetTick: 0, beats: 4, beatSec: 0.5, ticksPerBeat: 480 }

describe('preRollBeat', () => {
  it('counts the beats of the count-in from 1', () => {
    expect(preRollBeat(window, 10)).toBe(1)
    expect(preRollBeat(window, 10.49)).toBe(1)
    expect(preRollBeat(window, 10.5)).toBe(2)
    expect(preRollBeat(window, 11.99)).toBe(4)
  })

  it('stays within 1…beats at the edges', () => {
    expect(preRollBeat(window, 9)).toBe(1)
    expect(preRollBeat(window, 12)).toBe(4)
  })
})
