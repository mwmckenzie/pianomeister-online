import type { NotePalette } from '../settings/NotePalette'
import type { ColourOverrides } from './ColourOverrides'
import type { ColourSet } from './ColourSet'

/** What a backup's colour sets add to the ones here. */
export interface ColourSetMerge {
  readonly added: readonly ColourSet[]
  readonly overrides: Readonly<Partial<Record<NotePalette, ColourOverrides>>>
  /** Backup sets that have another id here → that id. */
  readonly idMap: ReadonlyMap<string, ColourSet['id']>
}
