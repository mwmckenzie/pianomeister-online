import type { PlayerSettings } from './settings/PlayerSettings'

const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const

type NameOptions = Pick<PlayerSettings['names'], 'octave' | 'accidentals'>

/**
 * The note name drawn on the highway and keys (brief decision 114): the letter with ♯ or ♭,
 * and the octave (scientific pitch, C4 = MIDI 60) on every C only or on every note.
 */
export function noteLabel(midi: number, options: NameOptions): string {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError(`Not a MIDI note: ${midi}`)
  }
  const pitchClass = midi % 12
  const letters = options.accidentals === 'flats' ? FLATS : SHARPS
  const letter = letters[pitchClass] as string
  const showOctave = options.octave === 'all' || pitchClass === 0
  return showOctave ? `${letter}${Math.floor(midi / 12) - 1}` : letter
}
