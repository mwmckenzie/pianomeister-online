import type { LoopRange } from '../transport/LoopRange'
import { barAtTick } from './barAtTick'
import type { BarLayout } from './BarLayout'

/**
 * A drag across the notes as whole bars (brief decision 103): every bar the drag touched, in
 * either direction, kept inside the song.
 */
export function snapSelection(layout: BarLayout, fromTick: number, toTick: number): LoopRange {
  const a = barAtTick(layout, Math.min(fromTick, toTick))
  const b = barAtTick(layout, Math.max(fromTick, toTick))
  return { startBar: a, endBar: b }
}
