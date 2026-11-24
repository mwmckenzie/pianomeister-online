/** What the Review page needs of a split: everything but the flips, which it applies itself. */
export interface HandReview {
  /** One char per note in extractNotes order: R, L or -; no flips. */
  readonly computed: string
  /** Ids of the notes the method isn't sure about. */
  readonly uncertain: readonly string[]
}
