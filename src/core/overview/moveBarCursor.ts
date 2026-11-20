import type { LoopRange } from '../transport/LoopRange'
import type { BarCursor } from './BarCursor'

/**
 * ←/→ move the bar cursor and drop the selection; Shift+←/→ extend the selection from where
 * the cursor was (brief decision 104). Returns the new cursor and the selection it implies.
 */
export function moveBarCursor(
  cursor: BarCursor,
  step: -1 | 1,
  extend: boolean,
  firstBar: number,
  lastBar: number,
): { readonly cursor: BarCursor; readonly selection: LoopRange | null } {
  const bar = Math.min(lastBar, Math.max(firstBar, cursor.bar + step))
  if (!extend) return { cursor: { bar, anchor: null }, selection: null }
  const anchor = cursor.anchor ?? cursor.bar
  return {
    cursor: { bar, anchor },
    selection: { startBar: Math.min(anchor, bar), endBar: Math.max(anchor, bar) },
  }
}
