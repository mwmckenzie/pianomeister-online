import type { MidiFile } from '../midi/MidiFile'
import type { CachedHands } from './CachedHands'
import { fileSplitContext } from './fileSplitContext'
import { handsHash } from './handsHash'
import type { HandSettings } from './HandSettings'
import type { RawNote } from './RawNote'
import { resolveHands } from './resolveHands'
import { summariseHands } from './summariseHands'

/** Resolves the hands of a file already read, ready to store. */
export function resolveFileHands(
  file: MidiFile,
  notes: readonly RawNote[],
  settings: HandSettings,
): CachedHands {
  const { hands } = resolveHands(notes, settings, fileSplitContext(file))
  return { hash: handsHash(settings), hands, summary: summariseHands(notes, hands) }
}
