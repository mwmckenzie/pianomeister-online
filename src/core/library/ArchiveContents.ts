import type { LibraryDocument } from './LibraryDocument'

/** A library export read back: the document plus each upload's bytes. */
export interface ArchiveContents {
  readonly document: LibraryDocument
  readonly uploads: readonly {
    readonly fileName: string
    readonly addedAt: number
    readonly bytes: Uint8Array
  }[]
}
