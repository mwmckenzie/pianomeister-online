import { adjustLoopRange } from '../practice/adjustLoopRange'
import type { LoopRange } from '../transport/LoopRange'

/**
 * One end of a range dragged to `bar` (a loop handle, or a bookmark's grip): the loop rules
 * (`adjustLoopRange`), so the range stays inside the song and the dragged end pushes the other.
 */
export function resizeRange(
  range: LoopRange,
  end: 'start' | 'end',
  bar: number,
  firstBar: number,
  lastBar: number,
): LoopRange {
  const next = adjustLoopRange(
    { start: range.startBar, end: range.endBar },
    end === 'start' ? { start: bar } : { end: bar },
    firstBar,
    lastBar,
  )
  return { startBar: next.start, endBar: next.end }
}
