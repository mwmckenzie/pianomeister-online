import type { ImportPlan } from './ImportPlan'
import type { LibraryDocument } from './LibraryDocument'
import { normalizeTags } from './normalizeTags'

/**
 * Import merge rules (brief decision 32): imported metadata and meter overrides apply only to
 * songs in the library (after the import's uploads were added), and never replace local ones.
 */
export function planImport(
  document: LibraryDocument,
  existing: {
    readonly songIds: ReadonlySet<string>
    readonly metaIds: ReadonlySet<string>
    readonly overrideIds: ReadonlySet<string>
  },
): ImportPlan {
  const unknown = new Set<string>()
  const setMeta: [string, LibraryDocument['meta'][string]][] = []
  let metaKept = 0
  for (const [songId, edit] of Object.entries(document.meta)) {
    if (!existing.songIds.has(songId)) unknown.add(songId)
    else if (existing.metaIds.has(songId)) metaKept++
    else
      setMeta.push([
        songId,
        edit.tags === undefined ? edit : { ...edit, tags: normalizeTags(edit.tags) },
      ])
  }
  const setOverrides: [string, LibraryDocument['meterOverrides'][string]][] = []
  let overridesKept = 0
  for (const [songId, override] of Object.entries(document.meterOverrides)) {
    if (!existing.songIds.has(songId)) unknown.add(songId)
    else if (existing.overrideIds.has(songId)) overridesKept++
    else setOverrides.push([songId, override])
  }
  return {
    setMeta,
    setOverrides,
    metaApplied: setMeta.length,
    metaKept,
    overridesApplied: setOverrides.length,
    overridesKept,
    unknownSongs: unknown.size,
  }
}
