import type { SoundingNote } from '../sustain/SoundingNote'
import type { Hand } from './Hand'

export interface HandNote extends SoundingNote {
  readonly hand: Hand
  /**
   * The playlist timeline's deck (0 or 1, milestone 9.5): songs alternate decks, so a crossfade
   * fades one deck out while the other comes in. Absent outside listening (deck 0).
   */
  readonly deck?: number
}
