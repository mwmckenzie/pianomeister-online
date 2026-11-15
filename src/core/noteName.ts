import { pitchClassColor } from './pitchClassColors'

/** Scientific pitch name, e.g. 60 → "C4", 21 → "A0". */
export function noteName(midiNote: number): string {
  return `${pitchClassColor(midiNote).name}${Math.floor(midiNote / 12) - 1}`
}
