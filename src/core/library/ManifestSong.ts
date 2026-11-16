import type { SongFacts } from './SongFacts'

/** One bundled song in public/songs/manifest.json. title/composer/tags are edited by hand. */
export interface ManifestSong {
  /** SHA-256 of the file bytes. */
  readonly id: string
  readonly fileName: string
  readonly title: string
  readonly composer: string
  readonly tags: readonly string[]
  readonly facts: SongFacts
}
