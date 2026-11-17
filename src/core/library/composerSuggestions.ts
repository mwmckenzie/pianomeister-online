import type { SongMetaFields } from './SongMetaFields'

/** A composer already in the library, with how many songs carry that name. */
export interface ComposerCount {
  readonly name: string
  readonly count: number
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/** Every composer in the library, sorted by name, with song counts (brief decision 58). */
export function allComposers(songs: readonly Pick<SongMetaFields, 'composer'>[]): ComposerCount[] {
  const counts = new Map<string, number>()
  for (const { composer } of songs) {
    const name = composer.trim()
    if (name !== '') counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => collator.compare(a.name, b.name) || a.name.localeCompare(b.name))
}

/**
 * Composers whose name contains the typed text (case-insensitive), sorted by name, and whether
 * one of them matches it exactly (case-insensitive) — if not, "Add ‘…’ as a new composer" is
 * offered. An empty query matches everyone and offers nothing new.
 */
export function composerSuggestions(
  composers: readonly ComposerCount[],
  query: string,
): { readonly matches: readonly ComposerCount[]; readonly exactMatch: boolean } {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return { matches: composers, exactMatch: true }
  const matches = composers.filter((c) => c.name.toLocaleLowerCase().includes(needle))
  return { matches, exactMatch: matches.some((c) => c.name.toLocaleLowerCase() === needle) }
}
