import type { Hand } from './Hand'
import type { HandOf } from './HandOf'

/**
 * Every note's hand from a song's resolved assignment (milestone 10.5): `hands` holds one char
 * per id of `noteIds`. Null when they don't belong together (the cache is then of no use).
 */
export function assignmentHandOf(noteIds: readonly string[], hands: string): HandOf | null {
  if (noteIds.length !== hands.length) return null
  const byId = new Map<string, Hand>()
  noteIds.forEach((id, i) => {
    if (hands[i] === 'R') byId.set(id, 'right')
    else if (hands[i] === 'L') byId.set(id, 'left')
  })
  return (note) => byId.get(note.id) ?? null
}
