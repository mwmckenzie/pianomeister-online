/** Rows greyed out for one reason before the reason moves to the section's top. */
export const SHARED_HINT_MIN = 3

/**
 * Disabled-control hints worth saying once per section (brief decision 51): those that at least
 * SHARED_HINT_MIN rows share. Fewer rows keep their hints under each row. `hints` holds one entry
 * per visible row, null when the row is enabled.
 */
export function sharedHints(hints: Iterable<string | null>): string[] {
  const counts = new Map<string, number>()
  for (const hint of hints) if (hint !== null) counts.set(hint, (counts.get(hint) ?? 0) + 1)
  return [...counts].filter(([, n]) => n >= SHARED_HINT_MIN).map(([hint]) => hint)
}
