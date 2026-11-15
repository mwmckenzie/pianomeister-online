// @vitest-environment node
// Pure render model: runs in Node to prove it has no Three.js or DOM dependency.
import { describe, expect, it } from 'vitest'

import { keyLayout } from './keyLayout'
import { KEYBOARD } from './KEYBOARD'

describe('keyLayout', () => {
  const keys = keyLayout()
  const white = keys.filter((k) => !k.isBlack)
  const black = keys.filter((k) => k.isBlack)

  it('has 88 keys from A0 to C8: 52 white, 36 black', () => {
    expect(keys).toHaveLength(88)
    expect(keys[0]?.midi).toBe(21)
    expect(keys[87]?.midi).toBe(108)
    expect(white).toHaveLength(52)
    expect(black).toHaveLength(36)
  })

  it('spans 52 units: A0 at the left edge, C8 ending at the right edge', () => {
    expect(keys[0]).toMatchObject({ midi: 21, isBlack: false, x: 0 })
    const c8 = keys[87]
    expect((c8?.x ?? 0) + (c8?.width ?? 0)).toBe(52)
    expect(white.map((k) => k.x)).toEqual(Array.from({ length: 52 }, (_, i) => i))
  })

  it('centres each black key on the boundary between its white neighbours', () => {
    for (const b of black) {
      const left = keys.find((k) => k.midi === b.midi - 1)
      const right = keys.find((k) => k.midi === b.midi + 1)
      expect(left?.isBlack).toBe(false)
      expect(right?.isBlack).toBe(false)
      expect(b.x + b.width / 2).toBeCloseTo(right?.x ?? NaN, 12)
    }
  })

  it('keeps grand-piano proportions: black/white width 13.7/23.5, length 95/150', () => {
    const w = white[0]
    const b = black[0]
    expect((b?.width ?? 0) / (w?.width ?? 1)).toBeCloseTo(13.7 / 23.5, 12)
    expect((b?.length ?? 0) / (w?.length ?? 1)).toBeCloseTo(95 / 150, 12)
    expect(w?.width).toBe(1)
    expect(w?.length).toBeCloseTo(150 / 23.5, 12)
  })

  it('raises black keys only', () => {
    expect(white.every((k) => k.raised === 0)).toBe(true)
    expect(black.every((k) => k.raised === KEYBOARD.blackRaise && k.raised > 0)).toBe(true)
  })
})
