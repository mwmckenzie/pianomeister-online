/** Summary facts shown in the library list, computed once so listing never parses MIDI. */
export interface SongFacts {
  readonly durationSeconds: number
  readonly durationTicks: number
  readonly ppq: number
  /** Bar count with the file's own meter (see effectiveBars for overrides). */
  readonly bars: number
  /** Distinct time signatures in order of appearance, e.g. ["3/4"]. */
  readonly timeSignatures: readonly string[]
  /** Tempo at the start of the song. */
  readonly bpm: number
}
