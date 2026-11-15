/**
 * Raw Standard MIDI File writer for tests. @tonejs/midi can only write format 1 with one
 * channel per track, so Type 0 files, mixed-channel tracks and running status are built here.
 */
interface RawEvent {
  readonly tick: number
  /** Event bytes after the delta time, status byte included unless relying on running status. */
  readonly bytes: readonly number[]
}

interface SmfSpec {
  readonly format: 0 | 1
  readonly ppq: number
  readonly tracks: readonly (readonly RawEvent[])[]
}

export const ev = {
  noteOn: (tick: number, channel: number, midi: number, velocity = 100): RawEvent => ({
    tick,
    bytes: [0x90 | channel, midi, velocity],
  }),
  noteOff: (tick: number, channel: number, midi: number): RawEvent => ({
    tick,
    bytes: [0x80 | channel, midi, 0],
  }),
  cc: (tick: number, channel: number, controller: number, value: number): RawEvent => ({
    tick,
    bytes: [0xb0 | channel, controller, value],
  }),
  tempo: (tick: number, microsPerQuarter: number): RawEvent => ({
    tick,
    bytes: [
      0xff,
      0x51,
      3,
      (microsPerQuarter >> 16) & 0xff,
      (microsPerQuarter >> 8) & 0xff,
      microsPerQuarter & 0xff,
    ],
  }),
  timeSignature: (tick: number, numerator: number, denominator: number): RawEvent => ({
    tick,
    bytes: [0xff, 0x58, 4, numerator, Math.log2(denominator), 24, 8],
  }),
  trackName: (tick: number, name: string): RawEvent => ({
    tick,
    bytes: [0xff, 0x03, name.length, ...Array.from(name, (c) => c.charCodeAt(0))],
  }),
}

function varLen(value: number): number[] {
  const out = [value & 0x7f]
  let v = value >> 7
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80)
    v >>= 7
  }
  return out
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

function u16(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff]
}

const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0))

export function buildSmf(spec: SmfSpec): Uint8Array {
  const out: number[] = [...ascii('MThd'), ...u32(6), ...u16(spec.format)]
  out.push(...u16(spec.tracks.length), ...u16(spec.ppq))
  for (const track of spec.tracks) {
    // Stable sort keeps the caller's order for same-tick events (matters for running status).
    const events = [...track].sort((a, b) => a.tick - b.tick)
    const body: number[] = []
    let last = 0
    for (const e of events) {
      body.push(...varLen(e.tick - last), ...e.bytes)
      last = e.tick
    }
    body.push(0, 0xff, 0x2f, 0)
    out.push(...ascii('MTrk'), ...u32(body.length), ...body)
  }
  return new Uint8Array(out)
}
