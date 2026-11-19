import type { PlaySetup } from './PlaySetup'

/**
 * One playback stretch in the raw play log (brief decision 70): from play to pause, stop, the
 * song ending, a load, a change of setup or of what it matches, or the tab being hidden. Stats
 * are always computed from these. Setup fields are missing on records written before they
 * existed.
 */
export interface PlayRecord extends Partial<PlaySetup> {
  readonly id: string
  readonly profileId: string
  readonly sessionId: string
  readonly songId: string
  /**
   * What the setup matched exactly (decision 70): a bookmark id, `full:<songId>` for Full song,
   * or null for any other setup. Records of a deleted bookmark keep its id.
   */
  readonly bookmarkId: string | null
  /** Epoch ms. */
  readonly startedAt: number
  /** Wall-clock time spent playing, pre-roll included. */
  readonly playedMs: number
  /** Plays started during this stretch (decision 70: a start, each wrap, each loop jump). */
  readonly plays: number
  /** Milestone 7 only: the loaded bookmark had temporary changes. No longer written. */
  readonly temporary?: boolean
}
