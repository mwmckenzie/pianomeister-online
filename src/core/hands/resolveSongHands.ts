import { readMidiFile } from '../midi/readMidiFile'
import type { CachedHands } from './CachedHands'
import { extractNotes } from './extractNotes'
import { fileSplitContext } from './fileSplitContext'
import { handsHash } from './handsHash'
import type { HandSettings } from './HandSettings'
import { resolveHands } from './resolveHands'
import { summariseHands } from './summariseHands'

/** Resolves a file's hands with these settings, ready to store. */
export function resolveSongHands(bytes: Uint8Array, settings: HandSettings): CachedHands {
  const file = readMidiFile(bytes)
  const notes = extractNotes(file)
  const { hands } = resolveHands(notes, settings, fileSplitContext(file))
  return { hash: handsHash(settings), hands, summary: summariseHands(notes, hands) }
}
