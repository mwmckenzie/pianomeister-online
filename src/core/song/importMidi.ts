import { parseMidi } from './parseMidi'
import { sha256Hex } from './sha256Hex'
import type { Song } from './Song'

/**
 * Parses a Standard MIDI File into our Song model (parseMidi plus the content-hash id).
 */
export async function importMidi(
  bytes: Uint8Array,
  options: { readonly fileName: string },
): Promise<Song> {
  return { id: await sha256Hex(bytes), ...parseMidi(bytes, options) }
}
