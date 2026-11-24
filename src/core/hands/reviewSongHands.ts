import { readMidiFile } from '../midi/readMidiFile'
import { extractNotes } from './extractNotes'
import { fileSplitContext } from './fileSplitContext'
import type { HandReview } from './HandReview'
import type { HandSettings } from './HandSettings'
import { resolveHands } from './resolveHands'

/** A file's hands for the Review page, without flips. */
export function reviewSongHands(bytes: Uint8Array, settings: HandSettings): HandReview {
  const file = readMidiFile(bytes)
  const { hands, uncertain } = resolveHands(
    extractNotes(file),
    { ...settings, flips: {} },
    fileSplitContext(file),
  )
  return { computed: hands, uncertain: [...uncertain] }
}
