import type { Note } from '../song/Note'

/** A note plus how long it actually sounds once the sustain pedal is applied. */
export interface SoundingNote extends Note {
  /** ≥ endTick. The written endTick still drives visuals. */
  readonly soundEndTick: number
}
