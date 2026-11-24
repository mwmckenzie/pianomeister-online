/** A single note. Ticks are the source of truth; seconds are derived through the TempoMap. */
export interface Note {
  /** `track:noteOnEventIndex` in the file: stable, because a stored file never changes. */
  readonly id: string
  /** Index of the track (MTrk chunk) in the file. */
  readonly track: number
  readonly midi: number
  readonly channel: number
  readonly startTick: number
  readonly endTick: number
  /** 0–127. */
  readonly velocity: number
}
