import type { PlaySetup } from './PlaySetup'

/**
 * One playback stretch in the raw play log (brief decision 70): from play to pause, stop, song
 * or bookmark change, a change of setup (tempo, loop, metronome, temporary changes), or the tab
 * being hidden. Stats are always computed from these. The setup fields are missing on records
 * written before they existed.
 */
export interface PlayRecord extends Partial<PlaySetup> {
  readonly id: string
  readonly profileId: string
  readonly sessionId: string
  readonly songId: string
  /** The loaded bookmark's id, or `full:<songId>` for Full song. */
  readonly bookmarkId: string
  /** Epoch ms. */
  readonly startedAt: number
  /** Wall-clock time spent playing, pre-roll included. */
  readonly playedMs: number
  /** Complete passes of the loaded entry's range during this stretch. */
  readonly passes: number
}
