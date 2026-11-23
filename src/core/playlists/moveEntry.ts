/** `items` with the one at `from` moved to `to` (both clamped); the same array if nothing moves. */
export function moveEntry<T>(items: readonly T[], from: number, to: number): readonly T[] {
  const last = items.length - 1
  const target = Math.min(last, Math.max(0, to))
  if (from < 0 || from > last || target === from) return items
  const out = [...items]
  const [moved] = out.splice(from, 1)
  if (moved === undefined) return items
  out.splice(target, 0, moved)
  return out
}
