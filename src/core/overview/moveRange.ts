import type { LoopRange } from '../transport/LoopRange'

/**
 * A bookmark's body dragged by `delta` bars (brief decision 107): the length stays, and the
 * range stops at the song's first and last bars.
 */
export function moveRange(
  range: LoopRange,
  delta: number,
  firstBar: number,
  lastBar: number,
): LoopRange {
  const length = range.endBar - range.startBar
  const startBar = Math.min(
    Math.max(firstBar, lastBar - length),
    Math.max(firstBar, range.startBar + Math.round(delta)),
  )
  return { startBar, endBar: Math.min(lastBar, startBar + length) }
}
