import type { SettingKey } from '../settings/SettingKey'

/**
 * A named, complete playfield setup (brief decision 121). `values` holds look keys
 * (LOOK_KEYS); a key it lacks (an older look, or one written by hand) takes the device's
 * default when the look is applied, so the same look always gives the same picture. Built-in
 * looks ship with the app and can't be changed, renamed or deleted.
 */
export interface Look {
  /** A UUID; built-ins have fixed ids (`builtin:classic`). Playlists refer to looks by id. */
  readonly id: string
  readonly name: string
  readonly builtIn: boolean
  /** ISO 8601. */
  readonly createdAt: string
  /** ISO 8601. */
  readonly updatedAt: string
  readonly values: Readonly<Partial<Record<SettingKey, unknown>>>
}
