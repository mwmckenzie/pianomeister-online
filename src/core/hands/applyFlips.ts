import type { HandLetter } from './HandLetter'

/** Hands with the player's flips on top; Hidden notes stay hidden. */
export function applyFlips(
  noteIds: readonly string[],
  computed: string,
  flips: Readonly<Record<string, HandLetter>>,
): string {
  if (Object.keys(flips).length === 0) return computed
  return noteIds.map((id, i) => (computed[i] === '-' ? '-' : (flips[id] ?? computed[i]))).join('')
}
