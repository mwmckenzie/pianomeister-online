import type { SongFacts } from './SongFacts'

/** What the library list needs about a stored upload (everything but the bytes). */
export interface UploadInfo {
  readonly songId: string
  readonly fileName: string
  /** Original title, per brief decision 36. */
  readonly title: string
  /**
   * Original composer, guessed from the file (brief decision 79). Missing on uploads stored
   * before guessing existed (their composer was empty).
   */
  readonly composer?: string
  /** Epoch milliseconds. */
  readonly addedAt: number
  readonly facts: SongFacts
}
