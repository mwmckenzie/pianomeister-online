/** A span with the sustain pedal (CC64) down on one channel. */
export interface PedalInterval {
  readonly channel: number
  readonly startTick: number
  readonly endTick: number
}
