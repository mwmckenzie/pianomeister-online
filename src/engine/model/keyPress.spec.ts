// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { KEY_PRESS_SECONDS, KEY_RELEASE_SECONDS, keyPressAngle, keyPressStep } from './keyPress'

const frames = (seconds: number, dt = 1 / 120) => Math.round(seconds / dt)

describe('keyPressStep', () => {
  it('presses in 40 ms and releases more slowly, in 90 ms', () => {
    let p = 0
    const dt = 1 / 1000
    for (let i = 0; i < frames(KEY_PRESS_SECONDS, dt) - 1; i++) p = keyPressStep(p, true, dt)
    expect(p).toBeLessThan(1)
    p = keyPressStep(p, true, dt)
    expect(p).toBeCloseTo(1, 9)
    for (let i = 0; i < frames(KEY_RELEASE_SECONDS, dt) - 1; i++) p = keyPressStep(p, false, dt)
    expect(p).toBeGreaterThan(0)
    p = keyPressStep(p, false, dt)
    expect(p).toBeCloseTo(0, 9)
    expect(KEY_RELEASE_SECONDS).toBeGreaterThan(KEY_PRESS_SECONDS)
  })

  it('moves monotonically and never leaves 0–1, even with long frames', () => {
    let p = 0
    let last = 0
    for (const dt of [0.001, 0.016, 0.5, 2]) {
      p = keyPressStep(p, true, dt)
      expect(p).toBeGreaterThanOrEqual(last)
      expect(p).toBeLessThanOrEqual(1)
      last = p
    }
    for (const dt of [0.001, 0.016, 0.5, 2]) {
      p = keyPressStep(p, false, dt)
      expect(p).toBeLessThanOrEqual(last)
      expect(p).toBeGreaterThanOrEqual(0)
      last = p
    }
  })
})

describe('keyPressAngle', () => {
  const length = 150 / 23.5

  it('drops the front edge by exactly the press depth at full press', () => {
    const angle = keyPressAngle(1, 0.22, length)
    expect(length * Math.sin(angle)).toBeCloseTo(0.22, 12)
    expect(keyPressAngle(0, 0.22, length)).toBe(0)
  })

  it('eases without overshoot: monotonic, and never past the full angle', () => {
    const full = keyPressAngle(1, 0.22, length)
    let last = -1
    for (let i = 0; i <= 100; i++) {
      const angle = keyPressAngle(i / 100, 0.22, length)
      expect(angle).toBeGreaterThanOrEqual(last)
      expect(angle).toBeLessThanOrEqual(full + 1e-12)
      last = angle
    }
    expect(keyPressAngle(2, 0.22, length)).toBe(full)
  })

  it('turns less about a pivot behind the key, still dropping the front by the depth', () => {
    const pivot = 8
    const angle = keyPressAngle(1, 0.3, length, pivot)
    expect((pivot + length) * Math.sin(angle)).toBeCloseTo(0.3, 12)
    expect(angle).toBeLessThan(keyPressAngle(1, 0.3, length))
  })

  it('gives shorter (black) keys a steeper angle for the same depth', () => {
    expect(keyPressAngle(1, 0.22, length * 0.63)).toBeGreaterThan(keyPressAngle(1, 0.22, length))
  })
})
