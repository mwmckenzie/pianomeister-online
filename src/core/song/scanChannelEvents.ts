/** A channel (voice) message from a raw MIDI track. */
export interface RawChannelEvent {
  /** Index of the MTrk chunk, counting from 0. */
  readonly track: number
  readonly tick: number
  /** Status byte (0x80–0xEF): message kind in the high nibble, channel in the low nibble. */
  readonly status: number
  readonly data1: number
  /** 0 for one-data-byte messages (program change, channel pressure). */
  readonly data2: number
}

/**
 * Walks every channel message of a Standard MIDI File, skipping meta and sysex events.
 * We read raw events where @tonejs/midi loses information (channels of pedal-only tracks,
 * which chunk a note came from).
 */
export function scanChannelEvents(
  bytes: Uint8Array,
  visit: (event: RawChannelEvent) => void,
): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = 8 + view.getUint32(4) // skip MThd
  let track = 0

  const byteAt = (i: number): number => {
    if (i >= bytes.length) throw new Error('Truncated MIDI file')
    return bytes[i] as number
  }

  while (pos + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(pos, pos + 4))
    const length = view.getUint32(pos + 4)
    const end = Math.min(bytes.length, pos + 8 + length)
    let p = pos + 8
    pos = end
    if (id !== 'MTrk') continue

    let tick = 0
    let status = 0
    const varLen = (): number => {
      let value = 0
      for (let i = 0; i < 4; i++) {
        const b = byteAt(p++)
        value = (value << 7) | (b & 0x7f)
        if ((b & 0x80) === 0) break
      }
      return value
    }

    while (p < end) {
      tick += varLen()
      let first = byteAt(p)
      if (first >= 0x80) {
        p++
        if (first === 0xff) {
          p++ // meta type
          // varLen() advances p, so read the length before adding it.
          const metaLength = varLen()
          p += metaLength
          continue
        }
        if (first === 0xf0 || first === 0xf7) {
          const sysexLength = varLen()
          p += sysexLength
          continue
        }
        status = first
        first = byteAt(p)
      }
      if (status === 0) throw new Error('MIDI data byte without a status byte')
      const kind = status & 0xf0
      const twoDataBytes = kind !== 0xc0 && kind !== 0xd0
      visit({ track, tick, status, data1: first, data2: twoDataBytes ? byteAt(p + 1) : 0 })
      p += twoDataBytes ? 2 : 1
    }
    track++
  }
}
