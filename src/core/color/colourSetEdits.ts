import type { CustomSetId } from '../settings/CustomSetId'
import type { NoteColourSetId } from '../settings/NoteColourSetId'
import type { NotePalette } from '../settings/NotePalette'
import type { ColourOverrides } from './ColourOverrides'
import type { ColourSet } from './ColourSet'
import { isCustomSetId } from './isNoteColourSetId'
import type { NoteColourSets } from './NoteColourSets'

/**
 * One colour of a set changed. A built-in stores the change as an override, dropped when it is
 * the colour the set has anyway (`original`); a custom set stores the colour itself.
 */
export function setColour(
  sets: NoteColourSets,
  id: NoteColourSetId,
  pitchClass: number,
  hex: string,
  original: string,
): NoteColourSets {
  const colour = hex.toUpperCase()
  if (isCustomSetId(id)) {
    return {
      ...sets,
      custom: sets.custom.map((set) =>
        set.id === id
          ? { ...set, colours: set.colours.map((c, pc) => (pc === pitchClass ? colour : c)) }
          : set,
      ),
    }
  }
  if (colour === original.toUpperCase()) return resetColour(sets, id, pitchClass)
  return withOverrides(sets, id, { ...sets.overrides[id], [pitchClass]: colour })
}

export function resetColour(
  sets: NoteColourSets,
  id: NotePalette,
  pitchClass: number,
): NoteColourSets {
  return withOverrides(
    sets,
    id,
    Object.fromEntries(
      Object.entries(sets.overrides[id] ?? {}).filter(([pc]) => Number(pc) !== pitchClass),
    ),
  )
}

/** Every colour of a built-in set back to its own. */
export function resetSet(sets: NoteColourSets, id: NotePalette): NoteColourSets {
  return withOverrides(sets, id, {})
}

export function addSet(sets: NoteColourSets, set: ColourSet): NoteColourSets {
  return { ...sets, custom: [...sets.custom, set] }
}

export function renameSet(sets: NoteColourSets, id: CustomSetId, name: string): NoteColourSets {
  return { ...sets, custom: sets.custom.map((set) => (set.id === id ? { ...set, name } : set)) }
}

export function removeSet(sets: NoteColourSets, id: CustomSetId): NoteColourSets {
  return { ...sets, custom: sets.custom.filter((set) => set.id !== id) }
}

export function isSetModified(sets: NoteColourSets, id: NoteColourSetId): boolean {
  return !isCustomSetId(id) && sets.overrides[id] !== undefined
}

function withOverrides(
  sets: NoteColourSets,
  id: NotePalette,
  next: ColourOverrides,
): NoteColourSets {
  const { [id]: _old, ...others } = sets.overrides
  const overrides = Object.keys(next).length === 0 ? others : { ...others, [id]: next }
  return { ...sets, overrides }
}
