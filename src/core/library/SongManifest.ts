import type { ManifestSong } from './ManifestSong'

export interface SongManifest {
  readonly version: 1
  /** In display order; the first entry is the default song on first run. */
  readonly songs: readonly ManifestSong[]
}
