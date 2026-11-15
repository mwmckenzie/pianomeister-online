import type { Hand } from '../hands/Hand'
import type { HandNote } from '../hands/HandNote'

export interface NoteEvent {
  readonly note: HandNote
  readonly hand: Hand
  readonly isPreRoll: boolean
}
