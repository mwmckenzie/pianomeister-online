import type { SettingKey } from '../settings/SettingKey'
import { defaultValue } from '../settings/settingValues'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import { EMPTY_LOOKS } from './EMPTY_LOOKS'
import type { Look } from './Look'
import { LOOK_KEYS } from './LOOK_KEYS'
import type { LooksState } from './LooksState'
import { readLookValues } from './readLookValues'

const MAX_NAME = 60

/**
 * Looks as settings v6–v8 stored them in localStorage (milestone 9.1 moves saved looks to the
 * database). Values are first migrated from the stored version (`migrate`) and validated like
 * stored settings; those looks held appearance only, so every look key they lack is filled in
 * from today's defaults — the self-contained rule, decided once, at the move. Malformed entries
 * and duplicate or built-in ids are skipped. The active id is kept as stored: it may name a look
 * that's already in the database.
 */
export function readLooks(
  raw: unknown,
  migrate: (values: Record<string, unknown>) => Record<string, unknown> = (v) => v,
  now = new Date().toISOString(),
): LooksState {
  if (!isRecord(raw)) return EMPTY_LOOKS
  const ids = new Set(BUILT_IN_LOOKS.map((look) => look.id))
  const saved: Look[] = []
  for (const entry of Array.isArray(raw.saved) ? raw.saved : []) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string') {
      continue
    }
    const name = entry.name.trim().slice(0, MAX_NAME)
    if (name === '' || ids.has(entry.id)) continue
    ids.add(entry.id)
    const stored = readLookValues(migrate(isRecord(entry.values) ? entry.values : {}))
    const values: Partial<Record<SettingKey, unknown>> = {}
    for (const key of LOOK_KEYS) values[key] = key in stored ? stored[key] : defaultValue(key)
    saved.push({ id: entry.id, name, builtIn: false, createdAt: now, updatedAt: now, values })
  }
  return { active: typeof raw.active === 'string' ? raw.active : null, saved }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
