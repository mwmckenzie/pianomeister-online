import { PITCH_CLASS_COLORS } from '../pitchClassColors'
import type { NotePalette } from '../settings/NotePalette'

/** The settings a palette needs (the Notes section's colour rows). */
export interface NotePaletteChoice {
  readonly palette: NotePalette
  /** Mono: every note. */
  readonly paletteMono: string
  /** Two-tone: notes on white keys. */
  readonly paletteWhite: string
  /** Two-tone: notes on black keys. */
  readonly paletteBlack: string
}

/** Pitch classes on black keys (C# D# F# G# A#). */
const BLACK = new Set([1, 3, 6, 8, 10])

/**
 * Naturals C D E F G A B of each pitch-class palette. As in the default palette, each sharp is
 * a darker shade of the natural below it, so a black-key note reads as "that note, sharpened".
 */
const NATURALS: { readonly [P in 'warm' | 'cool' | 'neon' | 'pastel']: readonly string[] } = {
  // Reds through oranges to golds.
  warm: ['#FF2D2D', '#FF5A26', '#FF8A1F', '#FFA826', '#FFC633', '#FFE066', '#FF6F61'],
  // Ice blues through blues to violets.
  cool: ['#8FEFFF', '#5CCBFF', '#3D9BFF', '#5B78FF', '#7C62FF', '#A05CF5', '#C98BFF'],
  // Saturated pinks, cyans and limes.
  neon: ['#FF2BD6', '#2BF0FF', '#B8FF2B', '#FF5FA2', '#3DFF8C', '#3DA9FF', '#E02BFF'],
  // Soft, light tints.
  pastel: ['#FFADAD', '#FFE3A6', '#A6E3FF', '#FFC8A2', '#B9F5B0', '#CDB8FF', '#FFB8E6'],
}

/** Pitch class (0 = C) of each natural, in NATURALS order. */
const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11]

/** How dark a sharp is next to its natural (the default palette's C → C# is about 0.66). */
const SHARP_SHADE = 0.66

/** `hex` with each channel scaled by `factor` (0..1). */
function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) =>
    Math.round(((n >> shift) & 0xff) * factor)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(16)}${channel(8)}${channel(0)}`.toUpperCase()
}

/** Twelve colours from seven naturals: each sharp a shade of the natural below it. */
function byPitchClass(naturals: readonly string[]): readonly string[] {
  const out: string[] = []
  NATURAL_PCS.forEach((pc, i) => {
    const hex = naturals[i] as string
    out[pc] = hex.toUpperCase()
    if (BLACK.has(pc + 1)) out[pc + 1] = shade(hex, SHARP_SHADE)
  })
  return out
}

const PITCH_CLASS_PALETTES = {
  default: PITCH_CLASS_COLORS.map((c) => c.hex),
  warm: byPitchClass(NATURALS.warm),
  cool: byPitchClass(NATURALS.cool),
  neon: byPitchClass(NATURALS.neon),
  pastel: byPitchClass(NATURALS.pastel),
} as const

/**
 * The note colour of each pitch class (index 0 = C) for a palette choice: what the notes, the
 * pressed and approaching keys, the note-coloured effects and the labels' Auto colour use.
 */
export function notePaletteColors(choice: NotePaletteChoice): readonly string[] {
  switch (choice.palette) {
    case 'mono':
      return Array.from({ length: 12 }, () => choice.paletteMono.toUpperCase())
    case 'twoTone':
      return Array.from({ length: 12 }, (_, pc) =>
        (BLACK.has(pc) ? choice.paletteBlack : choice.paletteWhite).toUpperCase(),
      )
    default:
      return PITCH_CLASS_PALETTES[choice.palette]
  }
}
