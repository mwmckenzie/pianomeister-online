import type { BeatEvent } from './BeatEvent'
import type { NoteEvent } from './NoteEvent'
import type { TimelineChangeReason } from './TimelineChangeReason'
import type { TransportState } from './TransportState'

/** Event map for the note event bus. Audio, MIDI out and visuals all subscribe here. */
export interface TransportEvents {
  noteOn: NoteEvent
  noteOff: NoteEvent
  allNotesOff: undefined
  beat: BeatEvent
  stateChange: { readonly state: TransportState; readonly previous: TransportState }
  loopWrap: { readonly startBar: number; readonly endBar: number }
  timelineChange: { readonly reason: TimelineChangeReason }
}
