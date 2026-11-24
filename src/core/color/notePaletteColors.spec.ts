import { describe, expect, it } from 'vitest'

import { PITCH_CLASS_COLORS } from '../pitchClassColors'
import type { NotePalette } from '../settings/NotePalette'
import { EMPTY_COLOUR_SETS } from './EMPTY_COLOUR_SETS'
import { notePaletteColors } from './notePaletteColors'

const choice = (palette: NotePalette) => ({
  palette,
  paletteSaved: null,
  paletteMono: '#6fa8ff',
  paletteWhite: '#FFFFFF',
  paletteBlack: '#202020',
})

const HEX = /^#[0-9A-F]{6}$/

describe('notePaletteColors', () => {
  it('keeps today’s pitch-class palette as Default', () => {
    expect(notePaletteColors(choice('default'), EMPTY_COLOUR_SETS)).toEqual(
      PITCH_CLASS_COLORS.map((c) => c.hex),
    )
  })

  it.each(['warm', 'cool', 'neon', 'pastel'] as const)(
    'gives %s twelve distinct colours, each sharp a darker shade of the natural below',
    (palette) => {
      const colors = notePaletteColors(choice(palette), EMPTY_COLOUR_SETS)
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
    expect(new Set(notePaletteColors(choice('mono'), EMPTY_COLOUR_SETS))).toEqual(
      new Set(['#6FA8FF']),
    )
  })

  it('colours white-key and black-key notes apart in Two-tone', () => {
    const colors = notePaletteColors(choice('twoTone'), EMPTY_COLOUR_SETS)
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
    expect(
      notePaletteColors(choice('warm'), EMPTY_COLOUR_SETS).every((c) => hue(c).r >= hue(c).b),
    ).toBe(true)
    expect(
      notePaletteColors(choice('cool'), EMPTY_COLOUR_SETS).every((c) => hue(c).b >= hue(c).r),
    ).toBe(true)
  })

  it('lays changed colours over a built-in, and over the look’s own in Mono', () => {
    const sets = { overrides: { mono: { 1: '#123456' }, warm: { 0: '#000001' } }, custom: [] }
    expect(notePaletteColors(choice('warm'), sets)[0]).toBe('#000001')
    const mono = notePaletteColors(choice('mono'), sets)
    expect(mono[0]).toBe('#6FA8FF')
    expect(mono[1]).toBe('#123456')
  })

  it('follows a custom set, then the look’s copy of it, then Default', () => {
    const colours = Array.from({ length: 12 }, () => '#111111')
    const saved = { name: 'Mine', colours: Array.from({ length: 12 }, () => '#222222') }
    const mine = { ...choice('default'), palette: 'custom-a' as const, paletteSaved: saved }
    const sets = { overrides: {}, custom: [{ id: 'custom-a' as const, name: 'Mine', colours }] }
    expect(notePaletteColors(mine, sets)).toEqual(colours)
    expect(notePaletteColors(mine, EMPTY_COLOUR_SETS)).toEqual(saved.colours)
    expect(notePaletteColors({ ...mine, paletteSaved: null }, EMPTY_COLOUR_SETS)).toEqual(
      notePaletteColors(choice('default'), EMPTY_COLOUR_SETS),
    )
  })
})
