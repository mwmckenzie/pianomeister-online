import type { PlaylistEntry } from './PlaylistEntry'
import type { PlaylistRepeat } from './PlaylistRepeat'

/**
 * A playlist (milestone 9.5): full songs played back to back as background music, per profile.
 * `lookId` null = "Current look (no change)". Missing references never break it: a deleted song's
 * entry stays (shown as "Missing song", skipped when playing), a deleted look falls back to
 * "Current look". `lastPlayedAt` is the one thing listening remembers (no stats).
 */
export interface Playlist {
  /** A UUID. */
  readonly id: string
  readonly profileId: string
  readonly name: string
  readonly lookId: string | null
  readonly entries: readonly PlaylistEntry[]
  readonly shuffle: boolean
  readonly repeat: PlaylistRepeat
  /** ISO 8601. */
  readonly createdAt: string
  /** ISO 8601. */
  readonly updatedAt: string
  /** Epoch ms of the last Play, or null. */
  readonly lastPlayedAt: number | null
}
