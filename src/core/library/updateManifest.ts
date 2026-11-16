import type { ManifestSong } from './ManifestSong'
import type { SongFacts } from './SongFacts'
import type { SongManifest } from './SongManifest'

/**
 * Brings the manifest in line with the files on disk. Hand-edited title, composer and tags are
 * kept (matched by file name); ids and facts are refreshed; removed files drop out; new files
 * are appended in file-name order with the file name as title.
 */
export function updateManifest(
  existing: SongManifest | null,
  scanned: readonly { readonly fileName: string; readonly id: string; readonly facts: SongFacts }[],
): SongManifest {
  const byName = new Map(scanned.map((s) => [s.fileName, s]))
  const kept: ManifestSong[] = []
  for (const song of existing?.songs ?? []) {
    const file = byName.get(song.fileName)
    if (file === undefined) continue
    kept.push({ ...song, id: file.id, facts: file.facts })
    byName.delete(song.fileName)
  }
  const added = [...byName.values()]
    .sort((a, b) => (a.fileName < b.fileName ? -1 : 1))
    .map((file) => ({
      id: file.id,
      fileName: file.fileName,
      title: file.fileName.replace(/\.[^.]+$/, ''),
      composer: '',
      tags: [],
      facts: file.facts,
    }))
  return { version: 1, songs: [...kept, ...added] }
}
