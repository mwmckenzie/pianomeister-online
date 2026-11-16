import type { LibraryEntry } from './LibraryEntry'

/** Lowercase, with diacritics removed, so "dvorak" finds "Dvořák". */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/** Every word of the query must appear in the title, composer or a tag. */
export function matchesSearch(entry: LibraryEntry, query: string): boolean {
  const words = fold(query)
    .split(/\s+/)
    .filter((w) => w !== '')
  if (words.length === 0) return true
  const haystack = fold([entry.title, entry.composer, ...entry.tags].join('\n'))
  return words.every((w) => haystack.includes(w))
}
