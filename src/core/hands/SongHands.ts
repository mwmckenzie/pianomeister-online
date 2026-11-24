import type { HandNoteSummary } from './HandNoteSummary'

/** Where a song's hands come from, for lists. */
export interface SongHands {
  /** `default`: not detected yet, the channel map. `user`: the profile has its own. */
  readonly source: 'default' | 'detected' | 'user'
  /** Detection's confidence, 0–1; null when there is none. */
  readonly confidence: number | null
  /** Null when unknown (an upload with very old facts). */
  readonly summary: HandNoteSummary | null
}
