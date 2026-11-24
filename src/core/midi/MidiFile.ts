import type { MidiEvent } from './MidiEvent'

/** A Standard MIDI File, event by event: what hand detection reads and the export writes. */
export interface MidiFile {
  readonly format: 0 | 1 | 2
  /** Raw division word: positive = ticks per quarter note; bit 15 set = SMPTE. */
  readonly division: number
  readonly tracks: readonly { readonly events: readonly MidiEvent[] }[]
  /** Other chunks, kept as they are: written after the track with index `afterTrack` (-1 = first). */
  readonly unknownChunks: readonly {
    readonly afterTrack: number
    readonly id: string
    readonly data: Uint8Array
  }[]
}

export const META_TRACK_NAME = 0x03
export const META_END_OF_TRACK = 0x2f
export const META_TEMPO = 0x51

export function ticksPerBeat(file: MidiFile): number {
  return (file.division & 0x8000) !== 0 ? 480 : file.division
}
