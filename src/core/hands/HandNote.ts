import type { SoundingNote } from '../sustain/SoundingNote'
import type { Hand } from './Hand'

export interface HandNote extends SoundingNote {
  readonly hand: Hand
}
