import type { PracticeRow } from './PracticeRow'
import type { PracticeSortField } from './PracticeSortField'

function value(row: PracticeRow | undefined, field: PracticeSortField): number | null {
  if (row === undefined) return null
  switch (field) {
    case 'plays':
      return row.plays > 0 ? row.plays : null
    case 'time':
      return row.playedMs > 0 ? row.playedMs : null
    case 'last':
      return row.lastPlayedAt
    case 'bookmarks':
      return (row.bookmarks ?? 0) > 0 ? (row.bookmarks ?? 0) : null
  }
}

/**
 * Compares two rows by a practice column. `desc` (the default for these columns) puts the
 * most, the longest or the most recent first. Rows with nothing to show ("—") stay last in
 * both directions; 0 means equal (the caller breaks ties, e.g. by title).
 */
export function comparePractice(
  a: PracticeRow | undefined,
  b: PracticeRow | undefined,
  field: PracticeSortField,
  direction: 'asc' | 'desc',
): number {
  const va = value(a, field)
  const vb = value(b, field)
  if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1
  return direction === 'asc' ? va - vb : vb - va
}
