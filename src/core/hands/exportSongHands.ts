import { readMidiFile } from '../midi/readMidiFile'
import { writeMidiFile } from '../midi/writeMidiFile'
import { applyHandAssignment, type HandExportOptions } from './applyHandAssignment'
import { extractNotes } from './extractNotes'
import { fileSplitContext } from './fileSplitContext'
import type { HandLetter } from './HandLetter'
import type { HandSettings } from './HandSettings'
import { resolveHands } from './resolveHands'

/** A copy of the file with its hands on their own channels. Hidden voices are left unchanged. */
export function exportSongHands(
  bytes: Uint8Array,
  settings: HandSettings,
  options: HandExportOptions,
): Uint8Array {
  const file = readMidiFile(bytes)
  const notes = extractNotes(file)
  const { hands } = resolveHands(notes, settings, fileSplitContext(file))
  const assigned = new Map<string, HandLetter>()
  notes.forEach((n, i) => {
    const hand = hands[i]
    if (hand === 'R' || hand === 'L') assigned.set(n.id, hand)
  })
  return writeMidiFile(applyHandAssignment(file, notes, assigned, options))
}
