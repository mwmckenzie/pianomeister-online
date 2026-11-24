import type { HandNoteSummary } from './HandNoteSummary'

/** A song's resolved hands as stored, so a split never runs on song load. */
export interface CachedHands {
  /** handsHash of the settings they were resolved from. */
  readonly hash: string
  /** One char per note in extractNotes order: R, L or - (Hidden). */
  readonly hands: string
  readonly summary: HandNoteSummary
}
