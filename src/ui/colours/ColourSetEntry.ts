import type { NoteColourSetId } from '@/core/settings/NoteColourSetId'

/** A set as the editor lists it. */
export interface ColourSetEntry {
  readonly id: NoteColourSetId
  readonly name: string
  readonly modified: boolean
  readonly colours: readonly string[]
}
