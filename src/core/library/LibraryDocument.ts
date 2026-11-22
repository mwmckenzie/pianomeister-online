import type { LookFile } from '../looks/LookFile'
import type { MeterOverride } from '../timing/MeterOverride'
import type { PracticeData } from './PracticeData'
import type { SongMetaEdit } from './SongMetaEdit'

/** library.json inside a library export zip. */
export interface LibraryDocument {
  readonly format: 'pianomeister-library'
  /** "major.minor"; readers reject other major versions. */
  readonly version: string
  /** ISO timestamp. */
  readonly exportedAt: string
  readonly uploads: readonly {
    readonly songId: string
    readonly fileName: string
    readonly addedAt: number
    /** Path of the MIDI file inside the zip. */
    readonly path: string
  }[]
  /** Metadata edits for any song, bundled or uploaded, by songId. */
  readonly meta: Readonly<Record<string, SongMetaEdit>>
  readonly meterOverrides: Readonly<Record<string, MeterOverride>>
  /** From 1.1: profiles and everything that belongs to them (brief decision 75). */
  readonly practice?: PracticeData
  /**
   * From 1.3: the saved looks (never the built-ins), as a look file, so they migrate and
   * validate like an imported one (milestone 9.1).
   */
  readonly looks?: LookFile
}
