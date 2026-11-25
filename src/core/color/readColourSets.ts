import { BUILT_IN_COLOUR_SETS } from './BUILT_IN_COLOUR_SETS'
import type { ColourOverrides } from './ColourOverrides'
import type { ColourSet } from './ColourSet'
import { MAX_SET_NAME } from './freeSetName'
import { isCustomSetId } from './isNoteColourSetId'
import type { NoteColourSets } from './NoteColourSets'
import { parseHex } from './parseHex'
import type { SavedColours } from './SavedColours'

/** Stored or imported colour sets made valid; malformed entries and duplicate ids are dropped. */
export function readColourSets(raw: unknown): NoteColourSets {
  if (!isRecord(raw)) return { overrides: {}, custom: [] }
  const overrides: Record<string, ColourOverrides> = {}
  const stored = isRecord(raw.overrides) ? raw.overrides : {}
  for (const { id } of BUILT_IN_COLOUR_SETS) {
    const read = readOverrides(stored[id])
    if (Object.keys(read).length > 0) overrides[id] = read
  }
  const custom: ColourSet[] = []
  for (const entry of Array.isArray(raw.custom) ? raw.custom : []) {
    const saved = readSavedColours(entry)
    if (saved === null || !isRecord(entry) || !isCustomSetId(entry.id)) continue
    const { id } = entry
    if (custom.some((set) => set.id === id)) continue
    custom.push({ id, ...saved })
  }
  return { overrides, custom }
}

/** A name and twelve colours, or null. */
export function readSavedColours(raw: unknown): SavedColours | null {
  if (!isRecord(raw) || typeof raw.name !== 'string' || !Array.isArray(raw.colours)) return null
  const name = raw.name.trim().slice(0, MAX_SET_NAME).trimEnd()
  if (name === '' || raw.colours.length !== 12) return null
  const colours: string[] = []
  for (const value of raw.colours) {
    const hex = typeof value === 'string' ? parseHex(value) : null
    if (hex === null) return null
    colours.push(hex)
  }
  return { name, colours }
}

function readOverrides(raw: unknown): ColourOverrides {
  const out: Record<number, string> = {}
  if (!isRecord(raw)) return out
  for (let pc = 0; pc < 12; pc++) {
    const value = raw[String(pc)]
    const hex = typeof value === 'string' ? parseHex(value) : null
    if (hex !== null) out[pc] = hex
  }
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
