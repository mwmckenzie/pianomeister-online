import type { PlaylistEntry } from './PlaylistEntry'
import type { PlaylistRepeat } from './PlaylistRepeat'

/** A playlist in a file: no owner (the importing profile takes it) and no play history. */
export interface PlaylistFileEntry {
  readonly id: string
  readonly name: string
  readonly lookId: string | null
  readonly entries: readonly PlaylistEntry[]
  readonly shuffle: boolean
  readonly repeat: PlaylistRepeat
  readonly createdAt: string
}
