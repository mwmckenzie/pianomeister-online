import type { CustomSetId } from './CustomSetId'
import type { NotePalette } from './NotePalette'

/** A note colour set: a built-in one or one of the player's own (milestone 10.6). */
export type NoteColourSetId = NotePalette | CustomSetId
