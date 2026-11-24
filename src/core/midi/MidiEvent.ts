/** A channel message. Ticks are absolute; deltas are recomputed on writing. */
export type MidiChannelEvent =
  | {
      readonly kind: 'noteOn' | 'noteOff'
      readonly tick: number
      readonly channel: number
      readonly note: number
      readonly velocity: number
    }
  | {
      readonly kind: 'polyAftertouch'
      readonly tick: number
      readonly channel: number
      readonly note: number
      readonly pressure: number
    }
  | {
      readonly kind: 'controller'
      readonly tick: number
      readonly channel: number
      readonly controller: number
      readonly value: number
    }
  | {
      readonly kind: 'programChange'
      readonly tick: number
      readonly channel: number
      readonly program: number
    }
  | {
      readonly kind: 'channelAftertouch'
      readonly tick: number
      readonly channel: number
      readonly pressure: number
    }
  /** `value` is the raw 14-bit amount (8192 = centre). */
  | {
      readonly kind: 'pitchBend'
      readonly tick: number
      readonly channel: number
      readonly value: number
    }

export type MidiEvent =
  | MidiChannelEvent
  | {
      readonly kind: 'meta'
      readonly tick: number
      readonly metaType: number
      readonly data: Uint8Array
    }
  | {
      readonly kind: 'sysex'
      readonly tick: number
      readonly status: 0xf0 | 0xf7
      readonly data: Uint8Array
    }

export function isChannelEvent(e: MidiEvent): e is MidiChannelEvent {
  return e.kind !== 'meta' && e.kind !== 'sysex'
}
