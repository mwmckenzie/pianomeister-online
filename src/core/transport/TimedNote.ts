import type { HandNote } from '../hands/HandNote'

/** A note with its times in song seconds at 100% tempo. */
export interface TimedNote {
  readonly note: HandNote
  readonly startSec: number
  /** Written end: drives visuals and note-off events. */
  readonly endSec: number
  /** With the sustain pedal applied: drives sound. */
  readonly soundEndSec: number
}
