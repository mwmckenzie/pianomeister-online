import type { SongHands } from '../hands/SongHands'
import type { MeterOverride } from '../timing/MeterOverride'
import type { SongFacts } from './SongFacts'
import type { SongMetaFields } from './SongMetaFields'
import type { SongSource } from './SongSource'

/** One song as the library shows it: original facts merged with the user's edits. */
export interface LibraryEntry extends SongMetaFields {
  readonly songId: string
  readonly source: SongSource
  readonly fileName: string
  readonly original: SongMetaFields
  /** True when the user has metadata edits ("Reset to original" is available). */
  readonly edited: boolean
  readonly facts: SongFacts
  readonly override: MeterOverride | null
  /** Bar count with the meter override applied. */
  readonly bars: number
  /** Time signature as shown, e.g. "3/4" (the override's if set). */
  readonly timeSignature: string
  /** The profile's hands, else the detected ones, else the default from the file's channels. */
  readonly hands: SongHands
  /** Epoch ms for uploads; null for bundled songs. */
  readonly addedAt: number | null
}
