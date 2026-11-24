import type { HandLetter } from './HandLetter'

/**
 * Flips a note's hand. `computed` is its hand without flips; flipping back to it removes the
 * flip, so a later change of role or method applies to the note again.
 */
export function flipNote(
  flips: Readonly<Record<string, HandLetter>>,
  noteId: string,
  computed: HandLetter,
): Record<string, HandLetter> {
  const { [noteId]: flip, ...rest } = flips
  const next = (flip ?? computed) === 'R' ? 'L' : 'R'
  return next === computed ? rest : { ...rest, [noteId]: next }
}
