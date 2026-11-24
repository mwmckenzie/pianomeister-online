import type { Note } from '../song/Note'
import type { Hand } from './Hand'

/**
 * Which hand plays a note (milestone 10): the one function every note's hand comes from — sound,
 * the highway and the hand cages. Null = Hidden (no sound, no note, no cage). Today it reads the
 * channel assignment (channelHandOf); milestone 10.5 replaces it with a per-note assignment.
 */
export type HandOf = (note: Note) => Hand | null
