/** The keys one hand covers in one bar (milestone 10). */
export interface HandCage {
  /** The bar's number in the song's bar map. */
  readonly barIndex: number
  /** This bar's start and end (exclusive), carried cages included. */
  readonly startTick: number
  readonly endTick: number
  /** MIDI pitches, inclusive; always at least MIN_CAGE_SPREAD apart, within the 88 keys. */
  readonly low: number
  readonly high: number
  /** No note of the hand sounds in this bar: the previous bar's range, held (a rest). */
  readonly carried: boolean
}
