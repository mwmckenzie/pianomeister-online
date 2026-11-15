/** Reads the MThd chunk. @tonejs/midi doesn't expose the format, and it may drop an empty first track. */
export function readMidiHeader(bytes: Uint8Array): {
  readonly format: number
  readonly trackCount: number
} {
  const magic = String.fromCharCode(...bytes.subarray(0, 4))
  if (bytes.length < 14 || magic !== 'MThd') {
    throw new Error('Not a Standard MIDI File (missing MThd header)')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { format: view.getUint16(8), trackCount: view.getUint16(10) }
}
