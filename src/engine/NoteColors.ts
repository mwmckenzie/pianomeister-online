import type { Color } from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'

import { srgb } from './srgb'

/**
 * The note colour of each pitch class (index 0 = C), shared by everything that draws in a note's
 * colour: notes, pressed and approaching keys, the key light, now-line effects, the held glow, the
 * pitch-coloured now line and note labels. The Color objects are updated in place, so whatever
 * reads them per frame follows at once; whatever bakes them (geometry, textures) is recoloured
 * by the engine when `version` changes.
 */
export class NoteColors {
  readonly colors: readonly Color[] = PITCH_CLASS_COLORS.map((c) => srgb(c.hex))
  /** Bumped on every change, so bakers can tell they're stale. */
  version = 0
  private key = PITCH_CLASS_COLORS.map((c) => c.hex).join()

  /** Sets the twelve colours (#RRGGBB); returns true when anything changed. */
  set(hexes: readonly string[]): boolean {
    const key = hexes.join()
    if (key === this.key) return false
    this.key = key
    hexes.forEach((hex, i) => this.colors[i]?.copy(srgb(hex)))
    this.version++
    return true
  }

  /** The colour of a pitch class (white when out of range, which is a caller bug). */
  at(pitchClass: number): Color {
    return this.colors[((pitchClass % 12) + 12) % 12] as Color
  }
}
