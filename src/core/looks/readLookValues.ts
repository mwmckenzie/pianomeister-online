import { coerceSetting } from '../settings/coerceSetting'
import type { SettingKey } from '../settings/SettingKey'
import { defaultValue, settingDefinition } from '../settings/settingValues'
import { LOOK_KEYS } from './LOOK_KEYS'

/**
 * A look's values (flat `section.field` keys, already migrated) made valid like stored
 * settings: only look keys are kept (unknown and device-cost keys are dropped), numbers are
 * clamped to their ranges, unlisted choices and wrong types become the default. Keys the look
 * doesn't have stay missing, to take the device's default when it's applied.
 */
export function readLookValues(
  values: Readonly<Record<string, unknown>>,
): Partial<Record<SettingKey, unknown>> {
  const out: Partial<Record<SettingKey, unknown>> = {}
  for (const key of LOOK_KEYS) {
    if (!(key in values)) continue
    out[key] = coerceSetting(values[key], settingDefinition(key), defaultValue(key))
  }
  return out
}
