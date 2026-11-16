import type { LibraryEntry } from './LibraryEntry'
import type { LibraryGroup } from './LibraryGroup'

export const UNKNOWN_COMPOSER = 'Unknown composer'
export const NO_TAGS = 'No tags'

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/**
 * Groups already-sorted entries, keeping their order inside each group. Groups are ordered
 * by label, with the catch-all group last. By tag, a song appears under each of its tags;
 * tags that differ only in case share a group.
 */
export function groupEntries(
  entries: readonly LibraryEntry[],
  by: 'none' | 'composer' | 'tag',
): LibraryGroup[] {
  if (by === 'none') return [{ label: '', entries }]
  const fallback = by === 'composer' ? UNKNOWN_COMPOSER : NO_TAGS
  const groups = new Map<string, { label: string; entries: LibraryEntry[] }>()
  const add = (label: string, entry: LibraryEntry) => {
    const key = label.toLocaleLowerCase()
    const group = groups.get(key) ?? { label, entries: [] }
    group.entries.push(entry)
    groups.set(key, group)
  }
  for (const entry of entries) {
    if (by === 'composer') add(entry.composer.trim() === '' ? fallback : entry.composer, entry)
    else if (entry.tags.length === 0) add(fallback, entry)
    else for (const tag of entry.tags) add(tag, entry)
  }
  const isFallback = (g: { label: string }) => g.label === fallback
  return [...groups.values()].sort(
    (a, b) => Number(isFallback(a)) - Number(isFallback(b)) || collator.compare(a.label, b.label),
  )
}
