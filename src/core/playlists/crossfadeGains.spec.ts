// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { crossfadeGains } from './crossfadeGains'

const AT = [0, 0.25, 0.5, 0.75, 1]

describe('crossfadeGains', () => {
  // Gains at 0, 25, 50, 75 and 100 %; the next song's are the same backwards.
  it.each([
    ['sequential', [1, 0.6294, 0.067, 0, 0]],
    ['sCurve', [1, 0.8536, 0.5, 0.1464, 0]],
    ['equalPower', [1, 0.9239, 0.7071, 0.3827, 0]],
  ] as const)('%s', (curve, out) => {
    AT.forEach((t, i) => {
      const gains = crossfadeGains(t, curve)
      expect(gains.out).toBeCloseTo(out[i] ?? -1, 4)
      expect(gains.in).toBeCloseTo(out[out.length - 1 - i] ?? -1, 4)
    })
  })

  it('equal power keeps the loudness even', () => {
    for (const t of AT) {
      const g = crossfadeGains(t, 'equalPower')
      expect(g.out ** 2 + g.in ** 2).toBeCloseTo(1, 12)
    }
  })

  it('holds its ends outside the crossfade', () => {
    expect(crossfadeGains(-1, 'sequential')).toEqual({ out: 1, in: 0 })
    expect(crossfadeGains(2, 'sequential')).toEqual({ out: 0, in: 1 })
  })
})
