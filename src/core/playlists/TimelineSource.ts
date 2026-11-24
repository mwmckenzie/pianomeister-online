import type { HandCages } from '../cages/HandCages'
import type { HandNote } from '../hands/HandNote'
import type { Song } from '../song/Song'
import type { TempoMap } from '../timing/TempoMap'

/** A prepared song a playlist timeline is built from (its hand-assigned, pedalled notes). */
export interface TimelineSource {
  readonly song: Pick<Song, 'ppq' | 'tempoEvents' | 'timeSignatureEvents' | 'pedalIntervals'>
  readonly tempoMap: TempoMap
  readonly notes: readonly HandNote[]
  /** The song's own hand cages (milestone 10), placed on the timeline with its notes. */
  readonly handCages?: HandCages
}
