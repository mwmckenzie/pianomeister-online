import type { DeviceClass } from './DeviceClass'
import type { PlayerSettings } from './PlayerSettings'
import { SETTING_KEYS } from './SETTING_KEYS'
import { SETTINGS_REGISTRY } from './SETTINGS_REGISTRY'

function buildDefaults(device: DeviceClass): PlayerSettings {
  const out: Record<string, Record<string, unknown>> = {}
  for (const key of SETTING_KEYS) {
    const [section, field] = key.split('.') as [string, string]
    const def = SETTINGS_REGISTRY[key]
    out[section] ??= {}
    out[section][field] =
      device === 'tablet' && def.tabletDefault !== undefined ? def.tabletDefault : def.default
  }
  return out as unknown as PlayerSettings
}

/** Defaults from docs/brief.md, as declared in SETTINGS_REGISTRY (desktop). */
export const DEFAULT_SETTINGS: PlayerSettings = buildDefaults('desktop')

const TABLET_SETTINGS: PlayerSettings = buildDefaults('tablet')

/** The defaults for a kind of device (brief decision 110). */
export function defaultSettings(device: DeviceClass): PlayerSettings {
  return device === 'tablet' ? TABLET_SETTINGS : DEFAULT_SETTINGS
}
