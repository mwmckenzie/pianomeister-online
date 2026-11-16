/**
 * Trims and collapses whitespace, drops empty tags, and removes case-insensitive duplicates,
 * keeping the casing of the first occurrence.
 */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, ' ')
    const key = tag.toLocaleLowerCase()
    if (tag === '' || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}
