import type { LookFile } from '../looks/LookFile'
import type { PlaylistFileEntry } from './PlaylistFileEntry'

/**
 * A `.pmplaylist.json` file (milestone 9.5): one playlist or many, with the saved looks they use
 * (built-in looks resolve by id anywhere), so an import can bring them along.
 */
export interface PlaylistFile {
  readonly format: 'pianomeister-playlist'
  readonly version: number
  readonly playlists: readonly PlaylistFileEntry[]
  readonly looks?: LookFile
}
