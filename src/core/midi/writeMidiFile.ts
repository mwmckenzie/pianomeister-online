import type { MidiEvent } from './MidiEvent'
import { META_END_OF_TRACK, type MidiFile } from './MidiFile'

/** Writes a Standard MIDI File (ported from midi-transformer): no running status. */
export function writeMidiFile(file: MidiFile): Uint8Array {
  const out: number[] = [...ascii('MThd'), ...u32(6)]
  out.push(...u16(file.format === 0 && file.tracks.length > 1 ? 1 : file.format))
  out.push(...u16(file.tracks.length), ...u16(file.division))
  const chunk = (id: string, data: ArrayLike<number>) => {
    out.push(...ascii(id), ...u32(data.length))
    for (let i = 0; i < data.length; i++) out.push(data[i] as number)
  }
  const chunksAfter = (track: number) => {
    for (const c of file.unknownChunks) if (c.afterTrack === track) chunk(c.id, c.data)
  }
  chunksAfter(-1)
  file.tracks.forEach((track, i) => {
    chunk('MTrk', encodeTrack(normalizeTrack(track.events)))
    chunksAfter(i)
  })
  return Uint8Array.from(out)
}

/** Tick order (events sharing a tick keep theirs) and exactly one End of Track, last. */
function normalizeTrack(events: readonly MidiEvent[]): MidiEvent[] {
  let end = 0
  const body: MidiEvent[] = []
  for (const e of events) {
    end = Math.max(end, e.tick)
    if (e.kind !== 'meta' || e.metaType !== META_END_OF_TRACK) body.push(e)
  }
  body.sort((a, b) => a.tick - b.tick)
  body.push({ kind: 'meta', tick: end, metaType: META_END_OF_TRACK, data: new Uint8Array(0) })
  return body
}

function encodeTrack(events: readonly MidiEvent[]): number[] {
  const out: number[] = []
  let previous = 0
  for (const e of events) {
    out.push(...varLen(e.tick - previous))
    previous = e.tick
    switch (e.kind) {
      case 'meta':
        out.push(0xff, e.metaType, ...varLen(e.data.length), ...e.data)
        break
      case 'sysex':
        out.push(e.status, ...varLen(e.data.length), ...e.data)
        break
      case 'noteOff':
        out.push(0x80 | e.channel, e.note, e.velocity)
        break
      case 'noteOn':
        out.push(0x90 | e.channel, e.note, e.velocity)
        break
      case 'polyAftertouch':
        out.push(0xa0 | e.channel, e.note, e.pressure)
        break
      case 'controller':
        out.push(0xb0 | e.channel, e.controller, e.value)
        break
      case 'programChange':
        out.push(0xc0 | e.channel, e.program)
        break
      case 'channelAftertouch':
        out.push(0xd0 | e.channel, e.pressure)
        break
      case 'pitchBend':
        out.push(0xe0 | e.channel, e.value & 0x7f, (e.value >> 7) & 0x7f)
        break
    }
  }
  return out
}

const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0))
const u16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff]
const u32 = (n: number): number[] => [...u16(n >>> 16), ...u16(n)]

function varLen(value: number): number[] {
  const out = [value & 0x7f]
  for (let v = value >>> 7; v > 0; v >>>= 7) out.unshift((v & 0x7f) | 0x80)
  return out
}
