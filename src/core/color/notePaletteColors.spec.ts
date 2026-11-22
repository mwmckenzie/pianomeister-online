import { describe, expect, it } from 'vitest'

import { PITCH_CLASS_COLORS } from '../pitchClassColors'
import type { NotePalette } from '../settings/NotePalette'
import { notePaletteColors } from './notePaletteColors'

const choice = (palette: NotePalette) => ({
  palette,
  paletteMono: '#6fa8ff',
  paletteWhite: '#FFFFFF',
  paletteBlack: '#202020',
})

const HEX = /^#[0-9A-F]{6}$/

describe('notePaletteColors', () => {
  it('keeps today’s pitch-class palette as Default', () => {
    expect(notePaletteColors(choice('default'))).toEqual(PITCH_CLASS_COLORS.map((c) => c.hex))
  })

  it.each(['warm', 'cool', 'neon', 'pastel'] as const)(
    'gives %s twelve distinct colours, each sharp a darker shade of the natural below',
    (palette) => {
      const colors = notePaletteColors(choice(palette))
      expect(colors).toHaveLength(12)
      expect(colors.every((c) => HEX.test(c))).toBe(true)
      expect(new Set(colors).size).toBe(12)
      const value = (hex: string) => Number.parseInt(hex.slice(1, 3), 16)
      for (const [natural, sharp] of [
        [0, 1],
        [2, 3],
        [5, 6],
        [7, 8],
        [9, 10],
      ] as const) {
        expect(value(colors[sharp] as string)).toBeLessThanOrEqual(value(colors[natural] as string))
      }
    },
  )

  it('colours every note the custom colour in Mono', () => {
    expect(new Set(notePaletteColors(choice('mono')))).toEqual(new Set(['#6FA8FF']))
  })

  it('colours white-key and black-key notes apart in Two-tone', () => {
    const colors = notePaletteColors(choice('twoTone'))
    expect(colors[0]).toBe('#FFFFFF') // C
    expect(colors[1]).toBe('#202020') // C#
    expect(colors[4]).toBe('#FFFFFF') // E
    expect(colors[10]).toBe('#202020') // A#
  })

  it('makes Warm warm and Cool cool', () => {
    const hue = (hex: string) => {
      const [r, , b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
      return { r: r ?? 0, b: b ?? 0 }
    }
    expect(notePaletteColors(choice('warm')).every((c) => hue(c).r >= hue(c).b)).toBe(true)
    expect(notePaletteColors(choice('cool')).every((c) => hue(c).b >= hue(c).r)).toBe(true)
  })
})
