import type { PlayerSettings } from './PlayerSettings'
import type { SettingKey } from './SettingKey'

/** The value type of a setting key, e.g. `number` for `'keyboard.thickness'`. */
export type SettingValue<K extends SettingKey> = K extends `${infer S}.${infer F}`
  ? S extends keyof PlayerSettings
    ? F extends keyof PlayerSettings[S]
      ? PlayerSettings[S][F]
      : never
    : never
  : never
