/**
 * Applies a change to one end of a loop and moves the other end so the range stays valid: both
 * ends are whole bars within [firstBar, lastBar] and start ≤ end (a one-bar loop has start =
 * end). Moving the start past the end pulls the end along, and moving the end before the start
 * pulls the start back, so no invalid range can be set.
 */
export function adjustLoopRange(
  range: { readonly start: number; readonly end: number },
  change: { readonly start: number } | { readonly end: number },
  firstBar: number,
  lastBar: number,
): { readonly start: number; readonly end: number } {
  const clamp = (bar: number) =>
    Math.min(lastBar, Math.max(firstBar, Number.isFinite(bar) ? Math.round(bar) : firstBar))
  if ('start' in change) {
    const start = clamp(change.start)
    return { start, end: Math.max(start, clamp(range.end)) }
  }
  const end = clamp(change.end)
  return { start: Math.min(end, clamp(range.start)), end }
}
