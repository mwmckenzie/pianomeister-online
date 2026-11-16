// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BLACK_PRESS_CLEARANCE, constrainKeyboard } from './constrainKeyboard'
import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'

const keyboard = DEFAULT_SETTINGS.keyboard

describe('constrainKeyboard', () => {
  it('leaves the defaults unchanged (same object)', () => {
    expect(constrainKeyboard(keyboard)).toBe(keyboard)
    expect(keyboard.pressDepthBlack).toBeLessThanOrEqual(
      keyboard.blackHeight - BLACK_PRESS_CLEARANCE,
    )
  })

  it('keeps the black key height within the key thickness', () => {
    expect(constrainKeyboard({ ...keyboard, blackHeight: 0.9 }).blackHeight).toBe(0.6)
    expect(constrainKeyboard({ ...keyboard, thickness: 0.4 }).blackHeight).toBe(0.4)
  })

  it('keeps a pressed black key 0.08 above the white keys, following the black height', () => {
    expect(constrainKeyboard({ ...keyboard, pressDepthBlack: 1 }).pressDepthBlack).toBeCloseTo(
      12 / 23.5 - 0.08,
      8,
    )
    // Lowering the black keys clamps the depth with them.
    expect(constrainKeyboard({ ...keyboard, blackHeight: 0.2 }).pressDepthBlack).toBeCloseTo(
      0.12,
      12,
    )
    // Too low to press at all.
    expect(constrainKeyboard({ ...keyboard, blackHeight: 0.05 }).pressDepthBlack).toBe(0)
    // The height limit applies first: thickness 0.3 → height 0.3 → depth ≤ 0.22.
    expect(
      constrainKeyboard({ ...keyboard, thickness: 0.3, blackHeight: 0.6, pressDepthBlack: 1 })
        .pressDepthBlack,
    ).toBeCloseTo(0.22, 12)
  })

  it('keeps a pressed white key front above the keyboard bottom', () => {
    expect(constrainKeyboard({ ...keyboard, pressDepthWhite: 1 }).pressDepthWhite).toBe(0.6)
    expect(constrainKeyboard({ ...keyboard, thickness: 0.2 }).pressDepthWhite).toBe(0.2)
  })

  it('always satisfies all limits', () => {
    for (const thickness of [0.2, 0.4, 0.6, 1.2]) {
      for (const blackHeight of [0, 0.1, 0.5, 0.8, 1.2]) {
        for (const depth of [0, 0.2, 0.5, 1.2]) {
          const c = constrainKeyboard({
            ...keyboard,
            thickness,
            blackHeight,
            pressDepthBlack: depth,
            pressDepthWhite: depth,
          })
          expect(c.blackHeight).toBeLessThanOrEqual(c.thickness)
          expect(c.pressDepthBlack).toBeGreaterThanOrEqual(0)
          expect(c.blackHeight - c.pressDepthBlack).toBeGreaterThanOrEqual(
            Math.min(c.blackHeight, BLACK_PRESS_CLEARANCE) - 1e-9,
          )
          expect(c.pressDepthWhite).toBeLessThanOrEqual(c.thickness)
        }
      }
    }
  })
})
