import type { SongFacts } from './SongFacts'

/** What the library list needs about a stored upload (everything but the bytes). */
export interface UploadInfo {
  readonly songId: string
  readonly fileName: string
  /** Original title, per brief decision 36. */
  readonly title: string
  /** Epoch milliseconds. */
  readonly addedAt: number
  readonly facts: SongFacts
}
