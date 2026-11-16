/** The user-editable metadata of a song. */
export interface SongMetaFields {
  readonly title: string
  /** Empty when unknown. */
  readonly composer: string
  readonly tags: readonly string[]
}
