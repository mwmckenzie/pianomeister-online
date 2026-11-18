import type { PracticeRow } from '../stats/PracticeRow'
import type { PracticeSortField } from '../stats/PracticeSortField'
import { comparePractice } from '../stats/comparePractice'
import type { LibraryEntry } from './LibraryEntry'
import type { LibrarySortField } from './LibrarySortField'

type Compare = (a: LibraryEntry, b: LibraryEntry) => number

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const byTitle: Compare = (a, b) => collator.compare(a.title, b.title)

const COMPARE: Record<Exclude<LibrarySortField, PracticeSortField>, Compare> = {
  title: byTitle,
  composer: (a, b) => collator.compare(a.composer, b.composer),
  duration: (a, b) => a.facts.durationSeconds - b.facts.durationSeconds,
  // As shown: with the meter override applied.
  bars: (a, b) => a.bars - b.bars,
  // Bundled songs (no date) count as the oldest.
  dateAdded: (a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0),
  source: (a, b) => (a.source === b.source ? 0 : a.source === 'bundled' ? -1 : 1),
}

const PRACTICE_FIELDS: ReadonlySet<LibrarySortField> = new Set([
  'plays',
  'time',
  'last',
  'bookmarks',
])

function isPracticeField(field: LibrarySortField): field is PracticeSortField {
  return PRACTICE_FIELDS.has(field)
}

/**
 * Sorted copy. Ties are broken by title, ascending. Songs without a composer stay last when
 * sorting by composer, in either direction; songs with no practice data ("—") stay last when
 * sorting by a practice column (`practice`, keyed by song id).
 */
export function sortEntries(
  entries: readonly LibraryEntry[],
  field: LibrarySortField,
  direction: 'asc' | 'desc',
  practice: ReadonlyMap<string, PracticeRow> = new Map(),
): LibraryEntry[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    if (isPracticeField(field)) {
      return (
        comparePractice(practice.get(a.songId), practice.get(b.songId), field, direction) ||
        byTitle(a, b)
      )
    }
    if (field === 'composer') {
      const missing = Number(a.composer === '') - Number(b.composer === '')
      if (missing !== 0) return missing
    }
    return sign * COMPARE[field](a, b) || byTitle(a, b)
  })
}
