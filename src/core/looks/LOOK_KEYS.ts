import type { SettingKey } from '../settings/SettingKey'
import { SETTING_KEYS } from '../settings/SETTING_KEYS'
import { settingDefinition } from '../settings/settingValues'
import { COST_KEYS } from './COST_KEYS'

/**
 * The settings a look holds (brief decision 121): every setting in the playfield sidebar —
 * camera, keyboard, highway, lines, notes, note style, effects, cages, names and the bloom
 * look — except device cost (COST_KEYS). A look is the complete playfield setup.
 */
export const LOOK_KEYS: readonly SettingKey[] = SETTING_KEYS.filter(
  (key) => settingDefinition(key).home.area === 'sidebar' && !COST_KEYS.has(key),
)
