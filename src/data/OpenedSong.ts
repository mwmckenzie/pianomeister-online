import type { HandAssignment } from '@/core/hands/HandAssignment'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { Song } from '@/core/song/Song'
import type { MeterOverride } from '@/core/timing/MeterOverride'

/** A library song parsed and ready for playback, with its library settings. */
export interface OpenedSong {
  readonly entry: LibraryEntry
  readonly song: Song
  readonly hands: HandAssignment
  /** True when hands are the default (no stored assignment). */
  readonly defaultHands: boolean
  readonly override: MeterOverride | null
}
