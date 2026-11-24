import type { CustomSetId } from '../settings/CustomSetId'
import type { NoteColourSetId } from '../settings/NoteColourSetId'
import { BUILT_IN_COLOUR_SETS } from './BUILT_IN_COLOUR_SETS'

const CUSTOM = /^custom-[\w-]{1,80}$/

export function isCustomSetId(value: unknown): value is CustomSetId {
  return typeof value === 'string' && CUSTOM.test(value)
}

/** A built-in set's id, or one a custom set can have (whether or not that set exists here). */
export function isNoteColourSetId(value: unknown): value is NoteColourSetId {
  return BUILT_IN_COLOUR_SETS.some((set) => set.id === value) || isCustomSetId(value)
}
