import { EMPTY_COLOUR_SETS } from '../color/EMPTY_COLOUR_SETS'
import type { NoteColourSets } from '../color/NoteColourSets'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import type { Look } from './Look'
import { sameLookValues } from './lookValues'
import { uniqueLookName } from './uniqueLookName'

/**
 * Adds incoming looks beside the existing saved ones without ever overwriting one (milestone
 * 9.1, section A): an id that's taken (a saved or built-in look, or an earlier incoming one)
 * gets a new id, and a name that's taken becomes "Name (2)", "Name (3)", …. With
 * `skipIdentical` (backup import), a look whose id and values match a saved one is already
 * here and is skipped. Incoming looks are never built-in.
 */
export function mergeLooks(
  incoming: readonly Look[],
  existing: readonly Look[],
  newId: () => string,
  skipIdentical = false,
  sets: NoteColourSets = EMPTY_COLOUR_SETS,
): {
  readonly added: readonly Look[]
  readonly skipped: number
  /** Each incoming id → the id it has here (a skipped look's is the local one's). */
  readonly idMap: ReadonlyMap<string, string>
} {
  const byId = new Map(existing.map((look) => [look.id, look]))
  const ids = new Set([...BUILT_IN_LOOKS, ...existing].map((look) => look.id))
  const names = new Set([...BUILT_IN_LOOKS, ...existing].map((look) => look.name.toLowerCase()))
  const added: Look[] = []
  const idMap = new Map<string, string>()
  let skipped = 0
  for (const look of incoming) {
    const mine = byId.get(look.id)
    if (skipIdentical && mine !== undefined && sameLookValues(mine, look, sets)) {
      skipped++
      idMap.set(look.id, mine.id)
      continue
    }
    const id = look.id === '' || ids.has(look.id) ? newId() : look.id
    const name = uniqueLookName(look.name, names)
    ids.add(id)
    names.add(name.toLowerCase())
    added.push({ ...look, id, name, builtIn: false })
    if (look.id !== '') idMap.set(look.id, id)
  }
  return { added, skipped, idMap }
}
