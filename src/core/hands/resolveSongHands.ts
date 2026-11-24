import { readMidiFile } from '../midi/readMidiFile'
import type { CachedHands } from './CachedHands'
import { extractNotes } from './extractNotes'
import type { HandSettings } from './HandSettings'
import { resolveFileHands } from './resolveFileHands'

/** Resolves a file's hands with these settings, ready to store. */
export function resolveSongHands(bytes: Uint8Array, settings: HandSettings): CachedHands {
  const file = readMidiFile(bytes)
  return resolveFileHands(file, extractNotes(file), settings)
}
