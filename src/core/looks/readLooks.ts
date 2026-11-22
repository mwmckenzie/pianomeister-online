import { coerceSetting } from '../settings/coerceSetting'
import type { SettingKey } from '../settings/SettingKey'
import { defaultValue, settingDefinition } from '../settings/settingValues'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import { EMPTY_LOOKS } from './EMPTY_LOOKS'
import type { Look } from './Look'
import { LOOK_KEYS } from './LOOK_KEYS'
import type { LooksState } from './LooksState'

const MAX_NAME = 60

/**
 * Saved looks from storage, validated: values are first migrated from the stored version
 * (`migrate`), then each is coerced like a stored setting, missing values get their defaults
 * (looks saved before a setting existed), unknown keys are dropped, and malformed entries or
 * duplicate ids are skipped. An active id that names no look is null.
 */
export function readLooks(
  raw: unknown,
  migrate: (values: Record<string, unknown>) => Record<string, unknown> = (v) => v,
): LooksState {
  if (!isRecord(raw) || !Array.isArray(raw.saved)) return EMPTY_LOOKS
  const ids = new Set(BUILT_IN_LOOKS.map((look) => look.id))
  const saved: Look[] = []
  for (const entry of raw.saved) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string') {
      continue
    }
    const name = entry.name.trim().slice(0, MAX_NAME)
    if (name === '' || ids.has(entry.id)) continue
    ids.add(entry.id)
    const stored = migrate(isRecord(entry.values) ? entry.values : {})
    const values: Partial<Record<SettingKey, unknown>> = {}
    for (const key of LOOK_KEYS) {
      values[key] = coerceSetting(stored[key], settingDefinition(key), defaultValue(key))
    }
    saved.push({ id: entry.id, name, builtIn: false, values })
  }
  const active = typeof raw.active === 'string' && ids.has(raw.active) ? raw.active : null
  return { active, saved }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
