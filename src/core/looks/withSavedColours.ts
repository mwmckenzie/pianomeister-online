import type { NoteColourSets } from '../color/NoteColourSets'
import type { SavedColours } from '../color/SavedColours'
import { savedColoursOf } from '../color/savedColoursOf'
import type { NoteColourSetId } from '../settings/NoteColourSetId'
import type { Look } from './Look'

/** The look with a fresh copy of its custom set's colours; unchanged when it has no custom set. */
export function withSavedColours(look: Look, sets: NoteColourSets): Look {
  const id = look.values['notes.palette'] as NoteColourSetId | undefined
  if (id === undefined) return look
  const current = (look.values['notes.paletteSaved'] ?? null) as SavedColours | null
  const saved = savedColoursOf(sets, id, current)
  if (JSON.stringify(saved) === JSON.stringify(current)) return look
  return { ...look, values: { ...look.values, 'notes.paletteSaved': saved } }
}
