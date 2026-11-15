/**
 * Scans a Standard MIDI File for one controller number (e.g. 64 = sustain pedal).
 * We read raw events rather than @tonejs/midi's controlChanges because tonejs only learns a
 * track's channel from its note-ons, so a pedal-only track (or split track) reports channel 0.
 */
export function readControllerEvents(
  bytes: Uint8Array,
  controller: number,
): { readonly tick: number; readonly channel: number; readonly value: number }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out: { tick: number; channel: number; value: number }[] = []
  let pos = 8 + view.getUint32(4) // skip MThd

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
      const dataBytes = kind === 0xc0 || kind === 0xd0 ? 1 : 2
      if (kind === 0xb0 && first === controller) {
        out.push({ tick, channel: status & 0x0f, value: byteAt(p + 1) })
      }
      p += dataBytes
    }
  }
  return out.sort((a, b) => a.tick - b.tick)
}
