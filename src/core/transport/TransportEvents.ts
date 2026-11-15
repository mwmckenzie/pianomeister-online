import type { NoteEvent } from './NoteEvent'
import type { TransportState } from './TransportState'

/** Event map for the note event bus. Audio, MIDI out and visuals all subscribe here. */
export interface TransportEvents {
  noteOn: NoteEvent
  noteOff: NoteEvent
  allNotesOff: undefined
  beat: { readonly bar: number; readonly beat: number; readonly isPreRoll: boolean }
  stateChange: { readonly state: TransportState; readonly previous: TransportState }
  loopWrap: { readonly startBar: number; readonly endBar: number }
}
