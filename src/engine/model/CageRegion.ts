/**
 * A region on the highway (brief decision 115): a tick range over a key range, or the full
 * width when the keys are null. An open start or end draws no border there, so consecutive
 * regions (milestone 10's per-bar hand cages) join without a line between them.
 */
export interface CageRegion {
  readonly startTick: number
  readonly endTick: number
  /** Lowest and highest key (MIDI) inside the cage; null = the whole highway width. */
  readonly lowMidi: number | null
  readonly highMidi: number | null
  readonly openStart?: boolean
  readonly openEnd?: boolean
}
