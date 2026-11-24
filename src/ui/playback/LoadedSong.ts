import type { HandCages } from '@/core/cages/HandCages'
import type { HandNote } from '@/core/hands/HandNote'
import type { PedalInterval } from '@/core/song/PedalInterval'
import type { Song } from '@/core/song/Song'
import type { BarMap } from '@/core/timing/BarMap'
import type { TempoMap } from '@/core/timing/TempoMap'

/** A song prepared for playback: hand-assigned notes plus the maps everything else reads. */
export interface LoadedSong {
  readonly song: Song
  readonly tempoMap: TempoMap
  readonly barMap: BarMap
  readonly notes: readonly HandNote[]
  /** Pedal spans of the assigned channels only. */
  readonly pedalIntervals: readonly PedalInterval[]
  /** The hand cages (milestone 10), from the same hand of each note as everything else. */
  readonly handCages: HandCages
}
