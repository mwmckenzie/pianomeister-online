/** A tempo change as stored in the file (integer microseconds per quarter note). */
export interface TempoEvent {
  readonly tick: number
  readonly microsPerQuarter: number
}
