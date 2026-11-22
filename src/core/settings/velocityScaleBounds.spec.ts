import { describe, expect, it } from 'vitest'

import { velocityScaleBounds } from './velocityScaleBounds'

describe('velocityScaleBounds', () => {
  it('passes sizes in order through', () => {
    expect(velocityScaleBounds({ minScale: 0.6, maxScale: 1.7 })).toEqual({
      min: 0.6,
      max: 1.7,
      limited: false,
    })
  })

  it('clamps the softest size to the loudest, keeping the loudest', () => {
    expect(velocityScaleBounds({ minScale: 2, maxScale: 1.2 })).toEqual({
      min: 1.2,
      max: 1.2,
      limited: true,
    })
  })

  it('is not limited when the two are equal', () => {
    expect(velocityScaleBounds({ minScale: 1, maxScale: 1 }).limited).toBe(false)
  })
})
