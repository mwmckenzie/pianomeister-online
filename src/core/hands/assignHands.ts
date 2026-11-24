import type { SoundingNote } from '../sustain/SoundingNote'
import type { HandNote } from './HandNote'
import type { HandOf } from './HandOf'

/** Tags notes with their hand (`handOf`); Hidden notes (null) are dropped: no sound, no note. */
export function assignHands(notes: readonly SoundingNote[], handOf: HandOf): HandNote[] {
  const out: HandNote[] = []
  for (const note of notes) {
    const hand = handOf(note)
    if (hand !== null) out.push({ ...note, hand })
  }
  return out
}
