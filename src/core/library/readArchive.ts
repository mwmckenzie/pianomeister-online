import { strFromU8, unzipSync } from 'fflate'

import type { MeterOverride } from '../timing/MeterOverride'
import type { ArchiveContents } from './ArchiveContents'
import { LIBRARY_FORMAT } from './buildArchive'
import type { LibraryDocument } from './LibraryDocument'
import { readPracticeData } from './readPracticeData'
import type { SongMetaEdit } from './SongMetaEdit'

const SUPPORTED_MAJOR = 1

/**
 * Reads a library export. Throws with a user-facing reason when the file isn't one, or comes
 * from an incompatible version. Malformed individual entries are dropped, not fatal.
 */
export function readArchive(bytes: Uint8Array): ArchiveContents {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('Not a zip file')
  }
  const json = files['library.json']
  if (json === undefined) throw new Error('Not a PianoMeister library export (no library.json)')
  let raw: unknown
  try {
    raw = JSON.parse(strFromU8(json))
  } catch {
    throw new Error('library.json is not valid JSON')
  }
  if (!isRecord(raw) || raw.format !== LIBRARY_FORMAT) {
    throw new Error('Not a PianoMeister library export')
  }
  const major = typeof raw.version === 'string' ? Number.parseInt(raw.version, 10) : NaN
  if (major !== SUPPORTED_MAJOR) {
    throw new Error(`Unsupported library export version ${String(raw.version)}`)
  }

  const uploads: LibraryDocument['uploads'][number][] = []
  const contents: ArchiveContents['uploads'][number][] = []
  for (const u of Array.isArray(raw.uploads) ? raw.uploads : []) {
    if (!isRecord(u)) continue
    const { songId, fileName, addedAt, path } = u
    if (typeof songId !== 'string' || typeof fileName !== 'string') continue
    if (typeof addedAt !== 'number' || typeof path !== 'string') continue
    const file = files[path]
    if (file === undefined) continue
    uploads.push({ songId, fileName, addedAt, path })
    contents.push({ fileName, addedAt, bytes: file })
  }

  const document: LibraryDocument = {
    format: LIBRARY_FORMAT,
    version: raw.version as string,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    uploads,
    meta: pick(raw.meta, toMetaEdit),
    meterOverrides: pick(raw.meterOverrides, toMeterOverride),
    practice: readPracticeData(raw.practice),
  }
  return { document, uploads: contents }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pick<T>(value: unknown, convert: (v: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {}
  if (!isRecord(value)) return out
  for (const [key, v] of Object.entries(value)) {
    const converted = convert(v)
    if (converted !== null) out[key] = converted
  }
  return out
}

function toMetaEdit(value: unknown): SongMetaEdit | null {
  if (!isRecord(value)) return null
  const { title, composer, tags } = value
  const edit: { title?: string; composer?: string; tags?: string[] } = {}
  if (typeof title === 'string') edit.title = title
  if (typeof composer === 'string') edit.composer = composer
  if (Array.isArray(tags) && tags.every((t) => typeof t === 'string')) edit.tags = tags
  return Object.keys(edit).length > 0 ? edit : null
}

function toMeterOverride(value: unknown): MeterOverride | null {
  if (!isRecord(value) || !isRecord(value.timeSignature)) return null
  const { numerator, denominator } = value.timeSignature
  const { barOneStartTick } = value
  const valid =
    Number.isInteger(numerator) &&
    (numerator as number) >= 1 &&
    (numerator as number) <= 32 &&
    [1, 2, 4, 8, 16, 32].includes(denominator as number) &&
    Number.isInteger(barOneStartTick) &&
    (barOneStartTick as number) >= 0
  if (!valid) return null
  return {
    timeSignature: { numerator: numerator as number, denominator: denominator as number },
    barOneStartTick: barOneStartTick as number,
  }
}
