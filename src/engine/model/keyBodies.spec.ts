// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'

import { keyBodies } from './keyBodies'
import { keyLayout } from './keyLayout'
import { KEYBOARD } from './KEYBOARD'

const keyboard = DEFAULT_SETTINGS.keyboard
const EPS = 1e-9

describe('keyBodies', () => {
  it('centres every body on its lane, for any gap', () => {
    const lanes = keyLayout()
    for (const gap of [0, 0.06, 0.15, 0.2]) {
      const bodies = keyBodies({ ...keyboard, gap })
      expect(bodies).toHaveLength(88)
      bodies.forEach((body, i) => {
        const lane = lanes[i]
        if (lane === undefined) throw new Error('missing lane')
        expect(body.midi).toBe(lane.midi)
        expect(body.centerX).toBeCloseTo(lane.x + lane.width / 2, 12)
        // Inside its lane.
        expect(body.centerX - body.width / 2).toBeGreaterThanOrEqual(lane.x - EPS)
        expect(body.centerX + body.width / 2).toBeLessThanOrEqual(lane.x + lane.width + EPS)
      })
    }
  })

  it('never moves the lanes', () => {
    const before = JSON.stringify(keyLayout())
    keyBodies({ ...keyboard, gap: 0.2, blackLengthRatio: 0.5 })
    expect(JSON.stringify(keyLayout())).toBe(before)
  })

  it('insets white keys by the gap; black keys keep their lane width', () => {
    const bodies = keyBodies({ ...keyboard, gap: 0.1 })
    const white = bodies.filter((b) => !b.isBlack)
    const black = bodies.filter((b) => b.isBlack)
    expect(white.every((b) => Math.abs(b.width - 0.9) < EPS)).toBe(true)
    expect(black.every((b) => Math.abs(b.width - KEYBOARD.blackWidth) < EPS)).toBe(true)
    expect(keyBodies({ ...keyboard, gap: 0 }).find((b) => !b.isBlack)?.width).toBe(1)
  })

  it('sets lengths and heights from the settings, at grand-piano proportions by default', () => {
    const bodies = keyBodies(keyboard)
    const white = bodies.find((b) => !b.isBlack)
    const black = bodies.find((b) => b.isBlack)
    expect(white).toMatchObject({ length: KEYBOARD.whiteLength, top: 0, thickness: 0.6 })
    expect(black?.length).toBeCloseTo(KEYBOARD.whiteLength * 0.63, 12)
    // 63% of 150 mm = 94.5 mm (a real grand: 95 mm), and 12 mm above the white keys.
    expect((black?.length ?? 0) * 23.5).toBeCloseTo(94.5, 9)
    expect((black?.top ?? 0) * 23.5).toBeCloseTo(12, 10)
    const custom = keyBodies({
      ...keyboard,
      blackLengthRatio: 0.7,
      blackHeight: 0.3,
      thickness: 0.4,
    })
    expect(custom.find((b) => b.isBlack)).toMatchObject({ top: 0.3, thickness: 0.4 })
    expect(custom.find((b) => b.isBlack)?.length).toBeCloseTo(KEYBOARD.whiteLength * 0.7, 12)
  })
})
