import type { PlayerSettings } from './PlayerSettings'
import { SETTING_KEYS } from './SETTING_KEYS'
import { SETTINGS_REGISTRY } from './SETTINGS_REGISTRY'

function buildDefaults(): PlayerSettings {
  const out: Record<string, Record<string, unknown>> = {}
  for (const key of SETTING_KEYS) {
    const [section, field] = key.split('.') as [string, string]
    out[section] ??= {}
    out[section][field] = SETTINGS_REGISTRY[key].default
  }
  return out as unknown as PlayerSettings
}

/** Defaults from docs/brief.md, as declared in SETTINGS_REGISTRY. */
export const DEFAULT_SETTINGS: PlayerSettings = buildDefaults()
