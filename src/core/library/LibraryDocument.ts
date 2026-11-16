import type { MeterOverride } from '../timing/MeterOverride'
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
}
