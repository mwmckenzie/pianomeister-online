import { constrainKeyboard } from './constrainKeyboard'
import { defaultSettings } from './DEFAULT_SETTINGS'
import type { DeviceClass } from './DeviceClass'
import type { PlayerSettings } from './PlayerSettings'
import type { SettingGroup } from './SettingGroup'
import type { SettingKey } from './SettingKey'
import { SETTING_KEYS } from './SETTING_KEYS'
import { isDefaultValue, readSetting, settingDefinition } from './settingValues'

/** Values of some settings, e.g. what a reset replaced (for Undo). */
export type SettingValues = ReadonlyMap<SettingKey, unknown>

/** The keys in a group, derived from each setting's home (declaration order). */
export function settingGroupKeys(group: SettingGroup): readonly SettingKey[] {
  return SETTING_KEYS.filter((key) => {
    const home = settingDefinition(key).home
    switch (group.kind) {
      case 'sidebar':
        return home.area === 'sidebar'
      case 'tab':
        return home.area === 'window' && home.tab === group.id
      case 'section':
        return home.section === group.id
    }
  })
}

/** How many settings in the group differ from their defaults (on this kind of device). */
export function changedCount(
  settings: PlayerSettings,
  group: SettingGroup,
  device: DeviceClass = 'desktop',
): number {
  return settingGroupKeys(group).filter(
    (key) => !isDefaultValue(key, readSetting(settings, key), device),
  ).length
}

/** Sets a group back to its defaults; `previous` holds the values it replaced, for Undo. */
export function resetGroup(
  settings: PlayerSettings,
  group: SettingGroup,
  device: DeviceClass = 'desktop',
): { readonly settings: PlayerSettings; readonly previous: SettingValues } {
  const keys = settingGroupKeys(group)
  const previous = new Map<SettingKey, unknown>(
    keys.map((key) => [key, readSetting(settings, key)]),
  )
  const base = defaultSettings(device)
  const defaults = new Map<SettingKey, unknown>(keys.map((key) => [key, readSetting(base, key)]))
  return { settings: assignValues(settings, defaults), previous }
}

/** Puts saved values back (Undo of a reset). */
export function restoreValues(settings: PlayerSettings, values: SettingValues): PlayerSettings {
  return assignValues(settings, values)
}

/**
 * Sets every value first and applies the keyboard limits once at the end: limiting after each
 * step could clamp a value against a neighbour that hasn't been set yet (depth before height).
 */
function assignValues(settings: PlayerSettings, values: SettingValues): PlayerSettings {
  const raw = structuredClone(settings) as unknown as Record<string, Record<string, unknown>>
  for (const [key, value] of values) {
    const [section, field] = key.split('.') as [string, string]
    const target = raw[section]
    if (target !== undefined) target[field] = value
  }
  const out = raw as unknown as PlayerSettings
  return { ...out, keyboard: constrainKeyboard(out.keyboard) }
}
