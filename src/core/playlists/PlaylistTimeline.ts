import type { HandCage } from '../cages/HandCage'
import type { Hand } from '../hands/Hand'
import type { HandNote } from '../hands/HandNote'
import type { PedalInterval } from '../song/PedalInterval'
import type { TransportSong } from '../transport/TransportSong'
import type { PlaylistTimelineSegment } from './TimelineSegment'

/**
 * Songs of a playlist placed one after another in time, as one song the transport, scheduler and
 * engine play unchanged (milestone 9.5): a common PPQ, a tempo map that takes each song's tempi
 * from its start, a bar map whose bars restart at each song, and every note tagged with its deck.
 */
export interface PlaylistTimeline {
  readonly song: TransportSong
  readonly ppq: number
  readonly notes: readonly (HandNote & { readonly deck: number })[]
  readonly pedalIntervals: readonly PedalInterval[]
  /** Each song's hand cages in timeline ticks, with the song's deck (milestone 10). */
  readonly handCages: Readonly<Record<Hand, readonly (HandCage & { readonly deck: number })[]>>
  readonly segments: readonly PlaylistTimelineSegment[]
}
