import type { SettingKey } from './SettingKey'
import { SETTINGS_REGISTRY } from './SETTINGS_REGISTRY'

/** All setting keys, in declaration order. */
export const SETTING_KEYS = Object.keys(SETTINGS_REGISTRY) as readonly SettingKey[]
