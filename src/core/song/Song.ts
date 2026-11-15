import type { ChannelInfo } from './ChannelInfo'
import type { Note } from './Note'
import type { PedalInterval } from './PedalInterval'
import type { TempoEvent } from './TempoEvent'
import type { TimeSignatureEvent } from './TimeSignatureEvent'

export interface Song {
  /** SHA-256 hex of the file bytes, so stats and bookmarks survive renames and re-uploads. */
  readonly id: string
  readonly title: string
  /** SMF format (0, 1 or 2). */
  readonly format: number
  readonly trackCount: number
  readonly ppq: number
  /** Sorted by startTick, then midi. */
  readonly notes: readonly Note[]
  /** Channels that have at least one note, ascending. */
  readonly channels: readonly ChannelInfo[]
  readonly tempoEvents: readonly TempoEvent[]
  readonly timeSignatureEvents: readonly TimeSignatureEvent[]
  /** Sustain pedal (CC64) down spans per channel, sorted by start. Affects sound only. */
  readonly pedalIntervals: readonly PedalInterval[]
  /** Tick of the last note-off. */
  readonly durationTicks: number
  readonly durationSeconds: number
}
