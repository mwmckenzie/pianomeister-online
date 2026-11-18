/** Unions overlapping or touching [startTick, endTick) spans, e.g. pedal intervals of both hands. */
export function mergeSpans(
  spans: readonly { readonly startTick: number; readonly endTick: number }[],
): { startTick: number; endTick: number }[] {
  const sorted = [...spans]
    .filter((s) => s.endTick > s.startTick)
    .sort((a, b) => a.startTick - b.startTick)
  const out: { startTick: number; endTick: number }[] = []
  for (const s of sorted) {
    const last = out[out.length - 1]
    if (last !== undefined && s.startTick <= last.endTick)
      last.endTick = Math.max(last.endTick, s.endTick)
    else out.push({ startTick: s.startTick, endTick: s.endTick })
  }
  return out
}
