import type { NoteColourSetId } from '../settings/NoteColourSetId'
import { isCustomSetId } from './isNoteColourSetId'
import type { NoteColourSets } from './NoteColourSets'
import type { SavedColours } from './SavedColours'

/**
 * The copy a look using this set should carry: the set's colours now, the copy it already has
 * while the set is missing, and none for a built-in (every device has those).
 */
export function savedColoursOf(
  sets: NoteColourSets,
  id: NoteColourSetId,
  current: SavedColours | null,
): SavedColours | null {
  if (!isCustomSetId(id)) return null
  const set = sets.custom.find((s) => s.id === id)
  return set === undefined ? current : { name: set.name, colours: set.colours }
}
