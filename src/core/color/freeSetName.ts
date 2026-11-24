import { BUILT_IN_COLOUR_SETS } from './BUILT_IN_COLOUR_SETS'
import type { NoteColourSets } from './NoteColourSets'

export const MAX_SET_NAME = 60

/** Whether a set (built-in, or custom other than `except`) has this name, in any case. */
export function isSetNameTaken(sets: NoteColourSets, name: string, except?: string): boolean {
  const lower = name.toLowerCase()
  return [...BUILT_IN_COLOUR_SETS, ...sets.custom].some(
    (set) => set.id !== except && set.name.toLowerCase() === lower,
  )
}

/** `name`, or "name 2", "name 3", … — the first no set has, within the length limit. */
export function freeSetName(sets: NoteColourSets, name: string): string {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : ` ${n}`
    const candidate = `${name.slice(0, MAX_SET_NAME - suffix.length).trimEnd()}${suffix}`
    if (!isSetNameTaken(sets, candidate)) return candidate
  }
}

/** The name of a copy: "name copy", "name copy 2", … */
export function copySetName(sets: NoteColourSets, name: string): string {
  return freeSetName(sets, `${name.slice(0, MAX_SET_NAME - 8).trimEnd()} copy`)
}
