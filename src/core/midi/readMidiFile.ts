import type { MidiEvent } from './MidiEvent'
import { META_END_OF_TRACK, type MidiFile } from './MidiFile'

/**
 * Reads every event of a Standard MIDI File (ported from midi-transformer). An event's index in
 * its track counts all events, meta and sysex included: note ids are built from it.
 */
export function readMidiFile(bytes: Uint8Array): MidiFile {
  const r = new Reader(bytes)
  if (r.text(4) !== 'MThd') throw new Error('Not a MIDI file (missing MThd header)')
  const headerLength = r.u32()
  const format = r.u16()
  r.u16() // track count: the chunks decide
  const division = r.u16()
  r.pos += headerLength - 6
  if (format !== 0 && format !== 1 && format !== 2) {
    throw new Error(`Unsupported MIDI format ${format}`)
  }
  const tracks: { events: MidiEvent[] }[] = []
  const unknownChunks: { afterTrack: number; id: string; data: Uint8Array }[] = []
  while (r.left >= 8) {
    const id = r.text(4)
    // Truncated files keep what's there.
    const data = r.take(Math.min(r.u32(), r.left))
    if (id === 'MTrk') tracks.push({ events: readTrack(new Reader(data)) })
    else unknownChunks.push({ afterTrack: tracks.length - 1, id, data })
  }
  return { format, division, tracks, unknownChunks }
}

class Reader {
  pos = 0
  constructor(private readonly bytes: Uint8Array) {}

  get left(): number {
    return this.bytes.length - this.pos
  }

  peek(): number {
    const b = this.bytes[this.pos]
    if (b === undefined) throw new Error('Truncated MIDI file')
    return b
  }

  u8(): number {
    const b = this.peek()
    this.pos++
    return b
  }

  u16(): number {
    return (this.u8() << 8) | this.u8()
  }

  u32(): number {
    return this.u16() * 0x10000 + this.u16()
  }

  text(length: number): string {
    return String.fromCharCode(...this.take(length))
  }

  varLen(): number {
    let value = 0
    for (let i = 0; i < 4; i++) {
      const b = this.u8()
      value = (value << 7) | (b & 0x7f)
      if ((b & 0x80) === 0) return value
    }
    throw new Error('Variable-length quantity too long')
  }

  take(length: number): Uint8Array {
    if (length > this.left) throw new Error('Truncated MIDI file')
    const out = this.bytes.slice(this.pos, this.pos + length)
    this.pos += length
    return out
  }
}

function readTrack(r: Reader): MidiEvent[] {
  const events: MidiEvent[] = []
  let tick = 0
  // Kept across meta and sysex events: some writers rely on it, and so does the rest of the app.
  let running = 0
  while (r.left > 0) {
    tick += r.varLen()
    let status = r.peek()
    if ((status & 0x80) !== 0) r.pos++
    else if (running === 0) throw new Error('MIDI data byte without a status byte')
    else status = running

    if (status === 0xff) {
      const metaType = r.u8()
      const data = r.take(r.varLen())
      events.push({ kind: 'meta', tick, metaType, data })
      if (metaType === META_END_OF_TRACK) break
      continue
    }
    if (status === 0xf0 || status === 0xf7) {
      events.push({ kind: 'sysex', tick, status, data: r.take(r.varLen()) })
      continue
    }
    // System common and realtime bytes don't belong in a file.
    if (status > 0xf0) continue
    running = status
    const channel = status & 0x0f
    const a = r.u8()
    switch (status & 0xf0) {
      case 0x80:
        events.push({ kind: 'noteOff', tick, channel, note: a, velocity: r.u8() })
        break
      case 0x90:
        events.push({ kind: 'noteOn', tick, channel, note: a, velocity: r.u8() })
        break
      case 0xa0:
        events.push({ kind: 'polyAftertouch', tick, channel, note: a, pressure: r.u8() })
        break
      case 0xb0:
        events.push({ kind: 'controller', tick, channel, controller: a, value: r.u8() })
        break
      case 0xc0:
        events.push({ kind: 'programChange', tick, channel, program: a })
        break
      case 0xd0:
        events.push({ kind: 'channelAftertouch', tick, channel, pressure: a })
        break
      case 0xe0:
        events.push({ kind: 'pitchBend', tick, channel, value: a | (r.u8() << 7) })
        break
    }
  }
  return events
}
