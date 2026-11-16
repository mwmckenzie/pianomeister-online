// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { effectiveBars } from './effectiveBars'

const facts = {
  durationSeconds: 8,
  durationTicks: 7680,
  ppq: 480,
  bars: 4,
  timeSignatures: ['4/4'],
  bpm: 120,
}

describe('effectiveBars', () => {
  it('uses the file bar count without an override', () => {
    expect(effectiveBars(facts, null)).toBe(4)
  })

  it('recomputes with the override meter and bar-1 start', () => {
    const override = { timeSignature: { numerator: 3, denominator: 4 }, barOneStartTick: 0 }
    // 16 beats in 3/4: bars 1–5 are full, bar 6 holds the last beat.
    expect(effectiveBars(facts, override)).toBe(6)
    // Starting bar 1 one beat later leaves 15 beats = 5 bars (plus a bar 0 pickup).
    expect(effectiveBars(facts, { ...override, barOneStartTick: 480 })).toBe(5)
  })
})
