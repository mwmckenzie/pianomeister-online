import type { SettingKey } from '../settings/SettingKey'

/**
 * A named set of appearance settings (brief decision 121). `values` holds a value for every
 * look key (LOOK_KEYS); built-in looks ship with the app and can't be changed or deleted.
 */
export interface Look {
  readonly id: string
  readonly name: string
  readonly builtIn: boolean
  readonly values: Readonly<Partial<Record<SettingKey, unknown>>>
}
