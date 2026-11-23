import { describe, expect, it } from 'vitest'

import { sliderLevel, sliderShare } from './sliderLevel'

describe('sliderLevel', () => {
  it('takes linear sliders at 20 / 50 / 80 % of the range', () => {
    expect(sliderLevel('highway.vignette', 'subtle')).toBe(0.2)
    expect(sliderLevel('highway.vignette', 'medium')).toBe(0.5)
    expect(sliderLevel('highway.vignette', 'strong')).toBe(0.8)
  })

  it('takes log sliders at 20 / 50 / 80 % of the thumb travel, not of the value', () => {
    // Bloom strength 0–3, log with a 0 stop: the middle of the travel is far below 1.5.
    const medium = sliderLevel('render.bloomStrength', 'medium')
    expect(medium).toBeLessThan(1)
    expect(sliderShare('render.bloomStrength', medium)).toBeCloseTo(0.5, 1)
    expect(
      sliderShare('render.bloomStrength', sliderLevel('render.bloomStrength', 'strong')),
    ).toBeCloseTo(0.8, 1)
  })

  it('orders the levels', () => {
    for (const key of [
      'effects.pulseAmount',
      'lines.bordersGlow',
      'effects.keySpillStrength',
    ] as const) {
      expect(sliderLevel(key, 'subtle')).toBeLessThan(sliderLevel(key, 'medium'))
      expect(sliderLevel(key, 'medium')).toBeLessThan(sliderLevel(key, 'strong'))
    }
  })

  it('refuses a setting that is not a number', () => {
    expect(() => sliderLevel('notes.palette', 'medium')).toThrow(TypeError)
  })
})
