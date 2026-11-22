import type { PlayerSettings } from './PlayerSettings'
import type { AnySettingDefinition } from './SettingDefinition'

/** Why a setting is greyed out under `settings`, or null when it has no hint. */
export function disabledHintOf(def: AnySettingDefinition, settings: PlayerSettings): string | null {
  const hint = def.disabledHint
  if (hint === undefined) return null
  return typeof hint === 'string' ? hint : hint(settings)
}
