import { adjustLoopRange } from './adjustLoopRange'

/**
 * Moves one end of a loop by whole bars (brief decision 92: the loop nudge commands and the loop
 * popover's −/+ buttons). It goes through adjustLoopRange, so the range stays within the song
 * and moving one end past the other pushes the other along.
 */
export function nudgeLoop(
  range: { readonly start: number; readonly end: number },
  edge: 'start' | 'end',
  bars: number,
  firstBar: number,
  lastBar: number,
): { readonly start: number; readonly end: number } {
  const change = edge === 'start' ? { start: range.start + bars } : { end: range.end + bars }
  return adjustLoopRange(range, change, firstBar, lastBar)
}
