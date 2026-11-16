import { scanChannelEvents } from './scanChannelEvents'

/**
 * Scans a Standard MIDI File for one controller number (e.g. 64 = sustain pedal).
 * We read raw events rather than @tonejs/midi's controlChanges because tonejs only learns a
 * track's channel from its note-ons, so a pedal-only track (or split track) reports channel 0.
 */
export function readControllerEvents(
  bytes: Uint8Array,
  controller: number,
): { readonly tick: number; readonly channel: number; readonly value: number }[] {
  const out: { tick: number; channel: number; value: number }[] = []
  scanChannelEvents(bytes, (e) => {
    if ((e.status & 0xf0) === 0xb0 && e.data1 === controller) {
      out.push({ tick: e.tick, channel: e.status & 0x0f, value: e.data2 })
    }
  })
  return out.sort((a, b) => a.tick - b.tick)
}
