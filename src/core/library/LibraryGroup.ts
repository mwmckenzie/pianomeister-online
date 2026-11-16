import type { LibraryEntry } from './LibraryEntry'

export interface LibraryGroup {
  /** Empty for the single group of an ungrouped list. */
  readonly label: string
  readonly entries: readonly LibraryEntry[]
}
