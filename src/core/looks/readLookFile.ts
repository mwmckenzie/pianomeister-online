import { migrateLookValues, SETTINGS_VERSION } from '../settings/loadSettings'
import type { Look } from './Look'
import type { LookFileResult } from './LookFileResult'
import { mergeLooks } from './mergeLooks'
import { readLookValues } from './readLookValues'

const MAX_NAME = 60
const LOOK_FORMAT = 'pianomeister-look'

/**
 * Reads a `.pmlook.json` file (Import, Paste look; milestone 9.1, section A) against the saved
 * looks: values from an older settings version are migrated, then validated like stored
 * settings (readLookValues: clamped, unknown and cost keys dropped, missing keys left to the
 * device's defaults); a taken id gets a new one and a taken name becomes "Name (2)". Malformed
 * entries are skipped. A file that isn't a look file, comes from a newer version or holds no
 * usable look gives an error and nothing else. A backup (`skipIdentical`) skips looks already
 * here with the same id and values.
 */
export function readLookFile(
  raw: unknown,
  existing: readonly Look[],
  newId: () => string,
  now = new Date().toISOString(),
  skipIdentical = false,
): LookFileResult {
  if (!isRecord(raw) || raw.format !== LOOK_FORMAT || !Array.isArray(raw.looks)) {
    return { ok: false, error: 'notLookFile' }
  }
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'notLookFile' }
  }
  if (version > SETTINGS_VERSION) return { ok: false, error: 'newer' }

  const looks: Look[] = []
  for (const entry of raw.looks) {
    if (!isRecord(entry) || typeof entry.name !== 'string' || !isRecord(entry.settings)) continue
    const name = entry.name.trim().slice(0, MAX_NAME)
    if (name === '') continue
    const flat: Record<string, unknown> = {}
    for (const [section, fields] of Object.entries(entry.settings)) {
      if (!isRecord(fields)) continue
      for (const [field, value] of Object.entries(fields)) flat[`${section}.${field}`] = value
    }
    const createdAt = isDate(entry.createdAt) ? entry.createdAt : now
    looks.push({
      id: typeof entry.id === 'string' ? entry.id : '',
      name,
      builtIn: false,
      createdAt,
      updatedAt: now,
      values: readLookValues(migrateLookValues(flat, version)),
    })
  }
  if (looks.length === 0) return { ok: false, error: 'empty' }
  const { added, skipped, idMap } = mergeLooks(looks, existing, newId, skipIdentical)
  return { ok: true, looks: added, skipped, idMap }
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
