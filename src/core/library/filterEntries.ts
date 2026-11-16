import type { LibraryEntry } from './LibraryEntry'
import type { SongSource } from './SongSource'

/** Keeps songs carrying every selected tag (case-insensitive) from the chosen source. */
export function filterEntries(
  entries: readonly LibraryEntry[],
  filter: { readonly tags: readonly string[]; readonly source: SongSource | 'all' },
): LibraryEntry[] {
  const wanted = filter.tags.map((t) => t.toLocaleLowerCase())
  return entries.filter((e) => {
    if (filter.source !== 'all' && e.source !== filter.source) return false
    const tags = new Set(e.tags.map((t) => t.toLocaleLowerCase()))
    return wanted.every((t) => tags.has(t))
  })
}
