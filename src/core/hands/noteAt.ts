/** A note as drawn in a roll lane, in px. */
export interface NoteBox {
  readonly index: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Thin or short notes take the pointer this many px beyond their box. */
const SLOP = 3

/**
 * The index of the note under the pointer, or null. A box that holds the point wins over one
 * only within reach; among those, the one whose middle is nearest in height, then the later one
 * (drawn on top).
 */
export function noteAt(boxes: readonly NoteBox[], x: number, y: number): number | null {
  let best: number | null = null
  let bestScore = Infinity
  for (const b of boxes) {
    const dx = Math.max(b.x - x, 0, x - (b.x + b.width))
    const dy = Math.max(b.y - y, 0, y - (b.y + b.height))
    if (dx > SLOP || dy > SLOP) continue
    const score = (dx + dy) * 1000 + Math.abs(y - (b.y + b.height / 2))
    if (score <= bestScore) {
      bestScore = score
      best = b.index
    }
  }
  return best
}
