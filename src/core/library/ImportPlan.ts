import type { MeterOverride } from '../timing/MeterOverride'
import type { SongMetaEdit } from './SongMetaEdit'

/** Which metadata and meter overrides an import writes, and what it reports. */
export interface ImportPlan {
  readonly setMeta: readonly (readonly [songId: string, edit: SongMetaEdit])[]
  readonly setOverrides: readonly (readonly [songId: string, override: MeterOverride])[]
  readonly metaApplied: number
  /** Songs whose local metadata edits were kept over the imported ones. */
  readonly metaKept: number
  readonly overridesApplied: number
  readonly overridesKept: number
  /** Entries for songs that aren't in the library (e.g. an upload missing from the zip). */
  readonly unknownSongs: number
}
