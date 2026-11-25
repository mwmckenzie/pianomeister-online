import { addSet } from './colourSetEdits'
import type { ColourSet } from './ColourSet'
import type { ColourSetMerge } from './ColourSetMerge'
import { freeSetName } from './freeSetName'
import type { NoteColourSets } from './NoteColourSets'

/**
 * Plans a backup's colour sets beside the local ones, overwriting nothing (milestone 10.6): a set
 * already here (id and colours) is skipped, a taken id gets a new one and a taken name a number;
 * changed colours come along only for a built-in that isn't changed here.
 */
export function mergeColourSets(
  local: NoteColourSets,
  incoming: NoteColourSets,
  newId: () => string,
): ColourSetMerge {
  const added: ColourSet[] = []
  const idMap = new Map<string, ColourSet['id']>()
  let all = local
  for (const set of incoming.custom) {
    const mine = all.custom.find((s) => s.id === set.id)
    if (mine !== undefined) {
      if (sameColours(mine, set)) continue
      // Added by an earlier import of this backup, under a new id and perhaps a number.
      const copy = local.custom.find((s) => sameColours(s, set) && s.name.startsWith(set.name))
      if (copy !== undefined) {
        idMap.set(set.id, copy.id)
        continue
      }
    }
    const id = mine === undefined ? set.id : (`custom-${newId()}` as const)
    const next = { id, name: freeSetName(all, set.name), colours: set.colours }
    if (id !== set.id) idMap.set(set.id, id)
    added.push(next)
    all = addSet(all, next)
  }
  const overrides = Object.fromEntries(
    Object.entries(incoming.overrides).filter(([id]) => !(id in local.overrides)),
  )
  return { added, overrides, idMap }
}

/** The plan applied to the sets as they are now. */
export function applyColourSetMerge(sets: NoteColourSets, merge: ColourSetMerge): NoteColourSets {
  return {
    overrides: { ...merge.overrides, ...sets.overrides },
    custom: [...sets.custom, ...merge.added],
  }
}

function sameColours(a: ColourSet, b: ColourSet): boolean {
  return a.colours.join() === b.colours.join()
}
