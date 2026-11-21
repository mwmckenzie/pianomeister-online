import type { LabelRect } from './LabelRect'

/**
 * Which labels to hide so none overlap (brief decision 114): `rects` come nearest first; each
 * is kept unless it overlaps one already kept, so of two overlapping labels the farther goes.
 * `gap` pixels of clearance count as overlap too.
 */
export function hiddenByOverlap(rects: readonly LabelRect[], gap = 0): boolean[] {
  const kept: LabelRect[] = []
  return rects.map((r) => {
    const hit = kept.some(
      (k) =>
        Math.abs(r.x - k.x) * 2 < r.width + k.width + 2 * gap &&
        Math.abs(r.y - k.y) * 2 < r.height + k.height + 2 * gap,
    )
    if (!hit) kept.push(r)
    return hit
  })
}
