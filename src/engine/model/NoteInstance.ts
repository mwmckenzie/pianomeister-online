import type { Hand } from '@/core/hands/Hand'

/** Per-note render data for the instanced note mesh (lane in world units, time in ticks). */
export interface NoteInstance {
  readonly midi: number
  readonly x: number
  readonly width: number
  readonly isBlack: boolean
  readonly startTick: number
  readonly endTick: number
  /** End of the solid head: a 1/64 note (ppq/16 ticks), or the whole note if shorter. */
  readonly headEndTick: number
  /** MIDI velocity 0–127 (drives the size of now-line effects). */
  readonly velocity: number
  /** Pitch class 0–11, indexing the note palette. */
  readonly colorIndex: number
  readonly hand: Hand
  /** The playlist timeline's deck (0 or 1; 0 outside listening): the crossfade band dims one. */
  readonly deck: number
}
