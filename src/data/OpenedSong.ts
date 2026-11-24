import type { HandOf } from '@/core/hands/HandOf'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { Song } from '@/core/song/Song'
import type { MeterOverride } from '@/core/timing/MeterOverride'

/** A library song parsed and ready for playback, with its library settings. */
export interface OpenedSong {
  readonly entry: LibraryEntry
  readonly song: Song
  /** Every note's hand: the profile's own, else detected, else the default channel map's. */
  readonly handOf: HandOf
  readonly override: MeterOverride | null
}
