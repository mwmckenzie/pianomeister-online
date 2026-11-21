// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { songClock } from './songClock'

const PPQ = 480

describe('songClock', () => {
  it('treats the first frame, going back and big steps as jumps', () => {
    expect(songClock(null, 100, 0.016, PPQ, 0).jumped).toBe(true)
    expect(songClock(1000, 500, 0.016, PPQ, 960).jumped).toBe(true)
    expect(songClock(0, 3 * PPQ, 0.016, PPQ, 960).jumped).toBe(true)
    expect(songClock(0, 16, 0.016, PPQ, 960).jumped).toBe(false)
  })

  it('measures the rate and holds it while paused or across jumps', () => {
    const first = songClock(0, 16, 1 / 60, PPQ, 0)
    expect(first.rate).toBeCloseTo(960)
    expect(songClock(16, 16, 1 / 60, PPQ, 960).rate).toBe(960)
    expect(songClock(16, 5000, 1 / 60, PPQ, 960).rate).toBe(960)
  })

  it('follows a tempo change smoothly', () => {
    let rate = 960
    let tick = 0
    for (let i = 0; i < 120; i++) {
      const next = tick + 480 / 60
      rate = songClock(tick, next, 1 / 60, PPQ, rate).rate
      tick = next
    }
    expect(rate).toBeCloseTo(480, 0)
    const one = songClock(0, 8, 1 / 60, PPQ, 960).rate
    expect(one).toBeLessThan(960)
    expect(one).toBeGreaterThan(480)
  })
})
