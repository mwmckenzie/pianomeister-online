import type { PlayerSettings } from './PlayerSettings'

type Section = keyof PlayerSettings & string

/** A setting's dotted path, e.g. `'keyboard.thickness'`. */
export type SettingKey = {
  [S in Section]: `${S}.${keyof PlayerSettings[S] & string}`
}[Section]
