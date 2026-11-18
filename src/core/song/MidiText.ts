/** The text a MIDI file carries about itself, for guessing its title and composer. */
export interface MidiText {
  /** The first track's name (the sequence name in format 0 and most format 1 files), or "". */
  readonly sequenceName: string
  /** Text events (meta type 1), in file order. */
  readonly texts: readonly string[]
  /** Copyright notices (meta type 2). */
  readonly copyrights: readonly string[]
}
