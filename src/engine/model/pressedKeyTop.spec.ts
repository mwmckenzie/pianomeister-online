// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BLACK_PRESS_CLEARANCE } from '@/core/settings/constrainKeyboard'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { keyBodies } from './keyBodies'
import { pressedKeyTop } from './pressedKeyTop'

const defaults = DEFAULT_SETTINGS.keyboard
const white = (k: PlayerSettings['keyboard']) => keyBodies(k).find((b) => !b.isBlack)
const black = (k: PlayerSettings['keyboard']) => keyBodies(k).find((b) => b.isBlack)

describe('pressedKeyTop', () => {
  it('drops the front edge by exactly the press depth, for any pivot', () => {
    for (const pivot of [0, 2, 8, 16]) {
      const k = { ...defaults, pivotOffsetWhite: pivot, pivotOffsetBlack: pivot }
      const w = white(k)
      const b = black(k)
      if (w === undefined || b === undefined) throw new Error('no keys')
      expect(w.top - pressedKeyTop(w, 1).frontY).toBeCloseTo(0.22, 12)
      expect(b.top - pressedKeyTop(b, 1).frontY).toBeCloseTo(0.3, 12)
      expect(pressedKeyTop(b, 0)).toEqual({ frontY: b.top, backY: b.top, backShiftZ: -0 })
    }
  })

  it('keeps white keys hinged at the play line by default (pivot at the back edge)', () => {
    const w = white(defaults)
    if (w === undefined) throw new Error('no key')
    const pose = pressedKeyTop(w, 1)
    expect(pose.backY).toBe(w.top)
    expect(pose.backShiftZ).toBeCloseTo(0, 12)
  })

  it('drops black keys nearly level by default: a slight tilt, the back edge only a little', () => {
    const b = black(defaults)
    if (b === undefined) throw new Error('no key')
    const pose = pressedKeyTop(b, 1)
    const backDrop = b.top - pose.backY
    const frontDrop = b.top - pose.frontY
    // Pivot at twice the visible length: the back drops 2/3 as far as the front.
    expect(backDrop / frontDrop).toBeCloseTo(2 / 3, 6)
    const tiltDeg = (Math.atan((frontDrop - backDrop) / b.length) * 180) / Math.PI
    expect(tiltDeg).toBeLessThan(2)
    // The back stays on the play line: it moves away from the player by a hair, never forward.
    expect(pose.backShiftZ).toBeLessThanOrEqual(0)
    expect(Math.abs(pose.backShiftZ)).toBeLessThan(0.01)
  })

  it('never lets a pressed black key reach the white key tops, under any settings', () => {
    for (const thickness of [0.2, 0.6, 1.2]) {
      for (const blackHeight of [0.1, 0.3, 0.51, 1.2]) {
        for (const pressDepthBlack of [0, 0.3, 1.12]) {
          for (const pivotOffsetBlack of [0, 8, 16]) {
            const b = black({
              ...defaults,
              thickness,
              blackHeight,
              pressDepthBlack,
              pivotOffsetBlack,
            })
            if (b === undefined) throw new Error('no key')
            // The black key body reaches down to the white keys (it never floats).
            expect(b.top).toBeLessThanOrEqual(b.thickness)
            for (const progress of [0, 0.5, 1]) {
              const pose = pressedKeyTop(b, progress)
              const lowest = Math.min(pose.frontY, pose.backY)
              expect(lowest).toBeGreaterThanOrEqual(Math.min(b.top, BLACK_PRESS_CLEARANCE) - 1e-12)
              expect(pose.backShiftZ).toBeLessThanOrEqual(0)
            }
          }
        }
      }
    }
  })

  it('never drops a pressed white key front below the keyboard bottom', () => {
    for (const thickness of [0.2, 0.6, 1.2]) {
      for (const pressDepthWhite of [0.22, 1.2]) {
        for (const pivotOffsetWhite of [0, 16]) {
          const w = white({ ...defaults, thickness, pressDepthWhite, pivotOffsetWhite })
          if (w === undefined) throw new Error('no key')
          expect(pressedKeyTop(w, 1).frontY).toBeGreaterThanOrEqual(-w.thickness - 1e-12)
        }
      }
    }
  })
})
