import type { Note } from '../song/Note'

/** A note with the events it came from, as hand detection and the hands export need it. */
export interface RawNote extends Note {
  /** `track:noteOnEventIndex`: stable, because a stored MIDI file never changes. */
  readonly id: string
  /** Index of the track (MTrk chunk) in the file. */
  readonly track: number
  readonly onIndex: number
  /** The matching note-off's index, or -1 when the note was never released. */
  readonly offIndex: number
}
