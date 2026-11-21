// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { ParticleRing } from './ParticleRing'

describe('ParticleRing', () => {
  it('hands out consecutive slots', () => {
    const ring = new ParticleRing(8)
    expect(ring.allocate(3)).toEqual([{ start: 0, count: 3 }])
    expect(ring.allocate(2)).toEqual([{ start: 3, count: 2 }])
  })

  it('wraps around, reusing the oldest slots first', () => {
    const ring = new ParticleRing(8)
    ring.allocate(6)
    expect(ring.allocate(4)).toEqual([
      { start: 6, count: 2 },
      { start: 0, count: 2 },
    ])
    // Slots 0–1 were the oldest; next come 2, 3, …
    expect(ring.allocate(1)).toEqual([{ start: 2, count: 1 }])
  })

  it('never hands out more than the capacity', () => {
    const ring = new ParticleRing(4)
    ring.allocate(1)
    const ranges = ring.allocate(10)
    expect(ranges.reduce((n, r) => n + r.count, 0)).toBe(4)
    expect(ranges).toEqual([
      { start: 1, count: 3 },
      { start: 0, count: 1 },
    ])
  })

  it('ignores empty requests and rejects a bad capacity', () => {
    expect(new ParticleRing(4).allocate(0)).toEqual([])
    expect(() => new ParticleRing(0)).toThrow(RangeError)
  })
})
