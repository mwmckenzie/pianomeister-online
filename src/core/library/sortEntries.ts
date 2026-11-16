import type { LibraryEntry } from './LibraryEntry'
import type { LibrarySortField } from './LibrarySortField'

type Compare = (a: LibraryEntry, b: LibraryEntry) => number

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const byTitle: Compare = (a, b) => collator.compare(a.title, b.title)

const COMPARE: Record<LibrarySortField, Compare> = {
  title: byTitle,
  composer: (a, b) => collator.compare(a.composer, b.composer),
  duration: (a, b) => a.facts.durationSeconds - b.facts.durationSeconds,
  // Bundled songs (no date) count as the oldest.
  dateAdded: (a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0),
  source: (a, b) => (a.source === b.source ? 0 : a.source === 'bundled' ? -1 : 1),
}

/**
 * Sorted copy. Ties are broken by title, ascending. Songs without a composer stay last when
 * sorting by composer, in either direction.
 */
export function sortEntries(
  entries: readonly LibraryEntry[],
  field: LibrarySortField,
  direction: 'asc' | 'desc',
): LibraryEntry[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    if (field === 'composer') {
      const missing = Number(a.composer === '') - Number(b.composer === '')
      if (missing !== 0) return missing
    }
    return sign * COMPARE[field](a, b) || byTitle(a, b)
  })
}
