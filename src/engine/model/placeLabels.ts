import type { LabelRect } from './LabelRect'
import type { LabelState } from './LabelState'

/** Clearance (px) a new label needs from the shown ones to show. */
export const PLACE_GAP = 2
/** Clearance (px) a hidden label needs before it fades in: more than PLACE_GAP, so it can't flicker. */
export const REVEAL_GAP = 4

/**
 * The overlap pass (brief decision 114). One-way: a shown label stays shown, whatever overlaps
 * it; a new label shows unless it overlaps a shown one, nearest first; a hidden label shows once
 * it clears every shown label by REVEAL_GAP. `labels` come nearest first; returns their states.
 */
export function placeLabels(
  labels: readonly { readonly rect: LabelRect; readonly state: LabelState }[],
): LabelState[] {
  const kept: LabelRect[] = labels.filter((l) => l.state === 'shown').map((l) => l.rect)
  return labels.map(({ rect, state }) => {
    if (state === 'shown') return 'shown'
    const gap = state === 'new' ? PLACE_GAP : REVEAL_GAP
    if (kept.some((k) => overlaps(rect, k, gap))) return 'hidden'
    kept.push(rect)
    return 'shown'
  })
}

function overlaps(a: LabelRect, b: LabelRect, gap: number): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width + 2 * gap &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height + 2 * gap
  )
}
