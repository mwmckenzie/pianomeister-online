import type { Note } from '../song/Note'
import type { Hand } from './Hand'

/**
 * Which hand plays a note (milestone 10): the one function every note's hand comes from — sound,
 * the highway and the hand cages. Null = Hidden (no sound, no note, no cage). It reads the
 * song's resolved assignment (assignmentHandOf), or the channel map until a song is detected.
 */
export type HandOf = (note: Note) => Hand | null
