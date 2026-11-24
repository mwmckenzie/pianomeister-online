import { NOTE_LABELS } from './NOTE_LABELS'
import { okLabDistance } from './okLabDistance'

/** Neighbouring notes nearer than this are hard to tell apart. */
const MIN_DISTANCE = 8
const LISTED = 3

/** Neighbouring pitch classes (B and C too) that look alike without being the same colour. */
export function closeNeighbours(
  colours: readonly string[],
): readonly (readonly [number, number])[] {
  const pairs: (readonly [number, number])[] = []
  for (let pc = 0; pc < 12; pc++) {
    const next = (pc + 1) % 12
    const a = colours[pc] as string
    const b = colours[next] as string
    // The same colour is a choice (Mono, Two-tone), never a mistake.
    if (a.toUpperCase() === b.toUpperCase()) continue
    if (okLabDistance(a, b) < MIN_DISTANCE) pairs.push([pc, next])
  }
  return pairs
}

/** The editor's advice about close neighbours, or null when there are none. */
export function closeNeighboursText(colours: readonly string[]): string | null {
  const pairs = closeNeighbours(colours)
  if (pairs.length === 0) return null
  const names = pairs.slice(0, LISTED).map(([a, b]) => `${NOTE_LABELS[a]} and ${NOTE_LABELS[b]}`)
  const more = pairs.length > LISTED ? ` and ${pairs.length - LISTED} more` : ''
  return `Hard to tell apart: ${names.join(', ')}${more}. Neighbouring notes may look the same on the highway.`
}
