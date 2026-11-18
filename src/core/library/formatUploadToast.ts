/**
 * The toast after an upload or drop (brief decision 82): "Added “Clair de Lune”", "3 songs
 * added", "Already in your library: Minuet in G", "2 added · 1 already in your library", with
 * "· 1 rejected" and "· filters cleared to show it" when they apply. Empty when nothing came of
 * it (only rejected files keep the notice under the list).
 */
export function formatUploadToast(outcome: {
  readonly added: readonly string[]
  readonly duplicates: readonly string[]
  readonly rejected: number
  readonly filtersCleared: boolean
}): string {
  const { added, duplicates, rejected } = outcome
  const parts: string[] = []
  if (added.length > 0 && duplicates.length > 0) {
    parts.push(`${added.length} added`, `${duplicates.length} already in your library`)
  } else if (added.length === 1) {
    parts.push(`Added “${added[0]}”`)
  } else if (added.length > 1) {
    parts.push(`${added.length} songs added`)
  } else if (duplicates.length === 1) {
    parts.push(`Already in your library: ${duplicates[0]}`)
  } else if (duplicates.length > 1) {
    parts.push(`${duplicates.length} songs already in your library`)
  }
  if (parts.length === 0) return ''
  if (rejected > 0) parts.push(`${rejected} rejected`)
  if (outcome.filtersCleared) parts.push('filters cleared to show it')
  return parts.join(' · ')
}
