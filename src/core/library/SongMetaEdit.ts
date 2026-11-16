/** A user's metadata edits for one song (shared across profiles). Absent fields keep the original. */
export interface SongMetaEdit {
  readonly title?: string
  readonly composer?: string
  readonly tags?: readonly string[]
}
