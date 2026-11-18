import type { LoopRange } from '../transport/LoopRange'

/**
 * A saved range fitted to the song as it is now: after a meter override a bookmark can reach
 * past the last bar. It is clamped where it's used, never rewritten (brief decision 67).
 */
export function clampRange(range: LoopRange, firstBar: number, lastBar: number): LoopRange {
  const clamp = (bar: number) => Math.min(lastBar, Math.max(firstBar, bar))
  const startBar = clamp(range.startBar)
  return { startBar, endBar: Math.max(startBar, clamp(range.endBar)) }
}
