import type { PlayerSettings } from '../settings/PlayerSettings'
import { restoreValues, type SettingValues } from '../settings/settingGroups'
import type { SettingKey } from '../settings/SettingKey'
import { isDefaultValue, readSetting, settingDefinition } from '../settings/settingValues'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import type { Look } from './Look'
import { LOOK_KEYS } from './LOOK_KEYS'
import type { LooksState } from './LooksState'

/** The current appearance settings as a look (brief decision 121). */
export function captureLook(settings: PlayerSettings, id: string, name: string): Look {
  return {
    id,
    name,
    builtIn: false,
    values: Object.fromEntries(LOOK_KEYS.map((key) => [key, readSetting(settings, key)])),
  }
}

/** Settings with all of a look's values; `previous` holds what they replaced, for Undo. */
export function applyLook(
  settings: PlayerSettings,
  look: Look,
): { readonly settings: PlayerSettings; readonly previous: SettingValues } {
  const previous = new Map<SettingKey, unknown>(
    LOOK_KEYS.map((key) => [key, readSetting(settings, key)]),
  )
  const values = new Map<SettingKey, unknown>()
  for (const key of LOOK_KEYS) {
    if (key in look.values) values.set(key, look.values[key])
  }
  return { settings: restoreValues(settings, values), previous }
}

/**
 * True when the settings no longer match the look ("⟨Look⟩ · modified"). Numbers within half
 * a slider step match, as for "changed from default".
 */
export function isLookModified(settings: PlayerSettings, look: Look): boolean {
  return LOOK_KEYS.some((key) => {
    const value = readSetting(settings, key)
    const target = look.values[key]
    if (target === undefined) return false
    const def = settingDefinition(key)
    if (def.kind === 'number') {
      return typeof value !== 'number' || Math.abs(value - (target as number)) >= def.step / 2
    }
    if (def.kind === 'color') {
      return String(value).toUpperCase() !== String(target).toUpperCase()
    }
    return value !== target
  })
}

/** Every look the picker offers: built-in first, then saved ones in the order saved. */
export function allLooks(state: LooksState): readonly Look[] {
  return [...BUILT_IN_LOOKS, ...state.saved]
}

/** The picked look, if it still exists. */
export function activeLook(state: LooksState): Look | null {
  return allLooks(state).find((look) => look.id === state.active) ?? null
}

/** True when every look setting is at its default (nothing to call "modified" yet). */
export function isDefaultLook(settings: PlayerSettings): boolean {
  return LOOK_KEYS.every((key) => isDefaultValue(key, readSetting(settings, key)))
}

/** A look name not used yet: "My look", "My look 2", … */
export function nextLookName(state: LooksState, base = 'My look'): string {
  const names = new Set(allLooks(state).map((look) => look.name.toLowerCase()))
  if (!names.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) {
    const name = `${base} ${n}`
    if (!names.has(name.toLowerCase())) return name
  }
}
