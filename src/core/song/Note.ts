/** A single note. Ticks are the source of truth; seconds are derived through the TempoMap. */
export interface Note {
  readonly midi: number
  readonly channel: number
  readonly startTick: number
  readonly endTick: number
  /** 0–127. */
  readonly velocity: number
}
