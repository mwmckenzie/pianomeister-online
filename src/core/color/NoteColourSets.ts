import type { NotePalette } from '../settings/NotePalette'
import type { ColourOverrides } from './ColourOverrides'
import type { ColourSet } from './ColourSet'

/** What the player changed about the note colours, device-wide (milestone 10.6). */
export interface NoteColourSets {
  /** Only sets with at least one changed colour are listed. */
  readonly overrides: Readonly<Partial<Record<NotePalette, ColourOverrides>>>
  /** In the order they were made. */
  readonly custom: readonly ColourSet[]
}
