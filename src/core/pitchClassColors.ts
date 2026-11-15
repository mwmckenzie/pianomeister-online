/** Note colors by pitch class (index 0 = C), per docs/brief.md. Each sharp is a darker shade of the natural below it. */
export const PITCH_CLASS_COLORS = [
  { name: 'C', hex: '#FF0000' },
  { name: 'C#', hex: '#A80000' },
  { name: 'D', hex: '#FFE500' },
  { name: 'D#', hex: '#A19000' },
  { name: 'E', hex: '#00C2FF' },
  { name: 'F', hex: '#FF9D00' },
  { name: 'F#', hex: '#D97500' },
  { name: 'G', hex: '#1CFF00' },
  { name: 'G#', hex: '#13AC00' },
  { name: 'A', hex: '#9500FF' },
  { name: 'A#', hex: '#5E00AB' },
  { name: 'B', hex: '#FF00D5' },
] as const

const MIDI_NOTE_MIN = 0
const MIDI_NOTE_MAX = 127

/**
 * Color for a MIDI note number. Accepts the full MIDI range (0–127), not just the
 * piano's 21–108, since every MIDI note has a pitch class; anything else is a caller bug.
 */
export function pitchClassColor(midiNote: number): (typeof PITCH_CLASS_COLORS)[number] {
  if (!Number.isInteger(midiNote) || midiNote < MIDI_NOTE_MIN || midiNote > MIDI_NOTE_MAX) {
    throw new RangeError(
      `MIDI note must be an integer in ${MIDI_NOTE_MIN}–${MIDI_NOTE_MAX}, got ${midiNote}`,
    )
  }
  const color = PITCH_CLASS_COLORS[midiNote % 12]
  if (color === undefined) {
    throw new RangeError(`No pitch class color for MIDI note ${midiNote}`)
  }
  return color
}
