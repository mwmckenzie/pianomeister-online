/**
 * The index range [from, to) of notes (sorted by startTick) that can overlap [startTick,
 * endTick): binary searches, starting `maxLength` ticks early for notes begun before the view.
 * The notes layer draws only these, so long songs stay quick to redraw.
 */
export function notesInView(
  notes: readonly { readonly startTick: number }[],
  maxLength: number,
  startTick: number,
  endTick: number,
): { readonly from: number; readonly to: number } {
  const firstAtOrAfter = (tick: number): number => {
    let lo = 0
    let hi = notes.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((notes[mid]?.startTick ?? Infinity) < tick) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  return { from: firstAtOrAfter(startTick - maxLength), to: firstAtOrAfter(endTick) }
}
