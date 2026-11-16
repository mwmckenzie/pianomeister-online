/** Outcome of one file in an upload or import. */
export type UploadResult =
  | {
      readonly fileName: string
      readonly outcome: 'added'
      readonly songId: string
      readonly title: string
    }
  | {
      readonly fileName: string
      readonly outcome: 'duplicate'
      readonly songId: string
      /** Display title of the song it duplicates. */
      readonly title: string
    }
  | { readonly fileName: string; readonly outcome: 'rejected'; readonly reason: string }
