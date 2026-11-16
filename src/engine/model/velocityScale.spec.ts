// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'

import { velocityScale } from './velocityScale'

describe('velocityScale', () => {
  const { effects } = DEFAULT_SETTINGS

  it('scales linearly from 0.6× at velocity 0 to 1.7× at 127', () => {
    expect(velocityScale(0, effects)).toBeCloseTo(0.6, 12)
    expect(velocityScale(127, effects)).toBeCloseTo(1.7, 12)
    expect(velocityScale(63.5, effects)).toBeCloseTo(1.15, 12)
  })

  it('clamps out-of-range velocities and is 1 for uniform size', () => {
    expect(velocityScale(-5, effects)).toBeCloseTo(0.6, 12)
    expect(velocityScale(200, effects)).toBeCloseTo(1.7, 12)
    expect(velocityScale(10, { ...effects, velocityScaling: false })).toBe(1)
  })
})
