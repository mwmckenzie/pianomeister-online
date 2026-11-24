import { strToU8, zipSync, type Zippable } from 'fflate'

import type { LookFile } from '../looks/LookFile'
import type { MeterOverride } from '../timing/MeterOverride'
import type { LibraryDocument } from './LibraryDocument'
import type { PracticeData } from './PracticeData'
import type { SongMetaEdit } from './SongMetaEdit'

export const LIBRARY_FORMAT = 'pianomeister-library'
export const LIBRARY_VERSION = '1.5'

/**
 * Zips all uploads plus library.json (with the profiles' practice data from 1.1, the saved
 * looks from 1.3, the profiles' playlists from 1.4 and hands per note from 1.5). MIDI is
 * already compact, so files are stored, not deflated.
 */
export function buildArchive(input: {
  readonly uploads: readonly {
    readonly songId: string
    readonly fileName: string
    readonly addedAt: number
    readonly bytes: Uint8Array
  }[]
  readonly meta: ReadonlyMap<string, SongMetaEdit>
  readonly overrides: ReadonlyMap<string, MeterOverride>
  readonly practice: PracticeData
  readonly looks: LookFile
  readonly exportedAt: Date
}): Uint8Array {
  const files: Zippable = {}
  const used = new Set<string>()
  const uploads = input.uploads.map((u) => {
    const path = uniquePath(u.fileName, used)
    files[path] = [u.bytes, { level: 0 }]
    return { songId: u.songId, fileName: u.fileName, addedAt: u.addedAt, path }
  })
  const document: LibraryDocument = {
    format: LIBRARY_FORMAT,
    version: LIBRARY_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    uploads,
    meta: Object.fromEntries(input.meta),
    meterOverrides: Object.fromEntries(input.overrides),
    practice: input.practice,
    looks: input.looks,
  }
  files['library.json'] = strToU8(JSON.stringify(document, null, 2))
  return zipSync(files)
}

/** uploads/<name>, with -2, -3… before the extension when two uploads share a file name. */
function uniquePath(fileName: string, used: Set<string>): string {
  const safe = fileName.replace(/[/\\]/g, '_')
  const dot = safe.lastIndexOf('.')
  const stem = dot > 0 ? safe.slice(0, dot) : safe
  const ext = dot > 0 ? safe.slice(dot) : ''
  let path = `uploads/${safe}`
  for (let n = 2; used.has(path.toLowerCase()); n++) path = `uploads/${stem}-${n}${ext}`
  used.add(path.toLowerCase())
  return path
}
