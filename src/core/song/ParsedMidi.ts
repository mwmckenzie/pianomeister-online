import type { Song } from './Song'

/** A parsed MIDI file before its content hash is known. */
export type ParsedMidi = Omit<Song, 'id'>
