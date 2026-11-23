import { describe, expect, it } from 'vitest'

import { LOG_SLIDER_STEPS, logSliderPosition, logSliderValue, snapToStep } from './logSlider'

const GLOW = { min: 0, max: 3, step: 0.05 }
const SIZE = { min: 0.35, max: 2.5, step: 0.05 }

describe('logSlider', () => {
  it('keeps a 0 stop at the far left when the range starts at 0', () => {
    expect(logSliderValue(0, GLOW)).toBe(0)
    expect(logSliderPosition(0, GLOW)).toBe(0)
    expect(logSliderValue(1, GLOW)).toBe(0.05)
  })

  it('reaches both ends', () => {
    expect(logSliderValue(LOG_SLIDER_STEPS, GLOW)).toBe(3)
    expect(logSliderValue(0, SIZE)).toBe(0.35)
    expect(logSliderValue(LOG_SLIDER_STEPS, SIZE)).toBe(2.5)
    expect(logSliderPosition(2.5, SIZE)).toBe(LOG_SLIDER_STEPS)
  })

  it('spends the middle of the travel on the geometric middle', () => {
    // sqrt(0.35 × 2.5) ≈ 0.935, snapped to 0.95 on the 0.05 grid from 0.35.
    expect(logSliderValue(LOG_SLIDER_STEPS / 2, SIZE)).toBeCloseTo(0.95, 10)
  })

  it('round-trips every reachable value', () => {
    for (let p = 0; p <= LOG_SLIDER_STEPS; p++) {
      const v = logSliderValue(p, GLOW)
      expect(logSliderValue(logSliderPosition(v, GLOW), GLOW)).toBe(v)
    }
  })

  it('is monotonic', () => {
    let last = -Infinity
    for (let p = 0; p <= LOG_SLIDER_STEPS; p++) {
      const v = logSliderValue(p, SIZE)
      expect(v).toBeGreaterThanOrEqual(last)
      last = v
    }
  })

  it('places values off the grid and out of range at the nearest end', () => {
    expect(logSliderPosition(-1, GLOW)).toBe(0)
    expect(logSliderPosition(9, GLOW)).toBe(LOG_SLIDER_STEPS)
    expect(logSliderPosition(0.01, GLOW)).toBe(0)
  })

  it('snaps to the step grid from the min, without float noise', () => {
    expect(snapToStep(0.3000001, { min: 0, max: 1, step: 0.1 })).toBe(0.3)
    expect(snapToStep(0.37, { min: 0.35, max: 2.5, step: 0.05 })).toBe(0.35)
    expect(snapToStep(9, SIZE)).toBe(2.5)
  })
})
