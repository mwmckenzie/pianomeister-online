import { constrainKeyboard } from './constrainKeyboard'
import type { PlayerSettings } from './PlayerSettings'
import type { SettingKey } from './SettingKey'
import { settingDefinition } from './settingValues'

/**
 * A number setting's upper limit for the current settings: the registry's max, lowered by the
 * keyboard's cross-setting limits (black height and press depths, brief decision 44).
 */
export function settingMax(key: SettingKey, settings: PlayerSettings): number {
  const def = settingDefinition(key)
  if (def.kind !== 'number') return Number.NaN
  const k = settings.keyboard
  switch (key) {
    case 'keyboard.blackHeight':
    case 'keyboard.pressDepthWhite':
      return Math.min(def.max, k.thickness)
    case 'keyboard.pressDepthBlack':
      return constrainKeyboard({ ...k, pressDepthBlack: def.max }).pressDepthBlack
    default:
      return def.max
  }
}
