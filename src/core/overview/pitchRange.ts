/** Semitones of room above the highest and below the lowest note. */
const MARGIN = 2

/**
 * The pitches the overview shows (brief decision 101): the notes' range plus a small margin,
 * at least an octave so a song of a few notes isn't drawn with huge rows. Without notes, the
 * octaves around middle C.
 */
export function pitchRange(notes: readonly { readonly midi: number }[]): {
  readonly low: number
  readonly high: number
} {
  if (notes.length === 0) return { low: 54, high: 78 }
  let low = Infinity
  let high = -Infinity
  for (const n of notes) {
    if (n.midi < low) low = n.midi
    if (n.midi > high) high = n.midi
  }
  low -= MARGIN
  high += MARGIN
  const short = 12 - (high - low)
  if (short > 0) {
    low -= Math.floor(short / 2)
    high += Math.ceil(short / 2)
  }
  return { low, high }
}
