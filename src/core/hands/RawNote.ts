import type { Note } from '../song/Note'

/** A note with the events it came from, as hand detection and the hands export need it. */
export interface RawNote extends Note {
  readonly onIndex: number
  /** The matching note-off's index, or -1 when the note was never released. */
  readonly offIndex: number
}
