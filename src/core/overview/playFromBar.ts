import { loopSeekBar } from '../transport/loopSeekBar'
import type { LoopRange } from '../transport/LoopRange'

/**
 * Where the loop editor's "Play from bar N" really starts (brief decision 106): the selection's
 * first bar, else the loop's start, else the bar cursor; with a loop on, a bar outside it
 * becomes the loop start, as for any seek (decision 8).
 */
export function playFromBar(
  selection: LoopRange | null,
  loop: LoopRange | null,
  cursorBar: number,
): number {
  const wanted = selection?.startBar ?? loop?.startBar ?? cursorBar
  return loopSeekBar(wanted, loop)
}
