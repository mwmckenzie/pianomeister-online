import type { HandNote } from '../hands/HandNote'

/** A note with its times in song seconds at 100% tempo. */
export interface TimedNote {
  readonly note: HandNote
  readonly startSec: number
  readonly endSec: number
}
