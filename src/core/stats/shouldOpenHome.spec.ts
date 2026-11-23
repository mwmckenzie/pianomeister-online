// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { homeCheckDelay } from './homeCheckDelay'
import { isNewSession } from './isNewSession'
import { sessionGapMs } from './sessionGapMs'
import { shouldOpenHome } from './shouldOpenHome'

const MIN = 60_000
const GAP = 30 * MIN

describe('isNewSession', () => {
  it('is new without earlier playback, or once more than the gap has passed', () => {
    expect(isNewSession(null, 0, GAP)).toBe(true)
    expect(isNewSession(0, GAP, GAP)).toBe(false)
    expect(isNewSession(0, GAP + 1, GAP)).toBe(true)
  })

  it('takes the gap from the "New session after" setting', () => {
    expect(sessionGapMs({ sessionGap: '10' })).toBe(10 * MIN)
    expect(sessionGapMs({ sessionGap: '60' })).toBe(60 * MIN)
  })
})

describe('shouldOpenHome', () => {
  const check = (now: number, lastPlaybackEnd: number | null, lastAutoOpen: number | null) =>
    shouldOpenHome({ now, lastPlaybackEnd, lastAutoOpen, gapMs: GAP })

  it('opens Home once a new session has begun, not within the gap', () => {
    expect(check(10 * MIN, 0, null)).toBe(false)
    expect(check(31 * MIN, 0, null)).toBe(true)
  })

  it('opens at most once per gap: not again on a refocus or reload before more playback', () => {
    expect(check(40 * MIN, 0, 31 * MIN)).toBe(false)
    expect(check(5 * 60 * MIN, 0, 31 * MIN)).toBe(false)
    // Playback since, then another gap: a new session again.
    expect(check(100 * MIN, 60 * MIN, 31 * MIN)).toBe(true)
  })

  it('never opens for a profile that never played (Start on decides a first run)', () => {
    expect(check(0, null, null)).toBe(false)
    expect(check(5 * 60 * MIN, null, null)).toBe(false)
  })
})

describe('homeCheckDelay', () => {
  it('is the time left until the gap passes, then just after now', () => {
    expect(homeCheckDelay(10 * MIN, 0, GAP)).toBe(20 * MIN + 1)
    expect(homeCheckDelay(40 * MIN, 0, GAP)).toBe(1)
    expect(homeCheckDelay(0, null, GAP)).toBeNull()
  })
})
