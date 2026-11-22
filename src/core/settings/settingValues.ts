import { applyQualityPreset } from './applyQualityPreset'
import { constrainKeyboard } from './constrainKeyboard'
import type { DeviceClass } from './DeviceClass'
import type { PlayerSettings } from './PlayerSettings'
import type { AnySettingDefinition } from './SettingDefinition'
import type { SettingKey } from './SettingKey'
import { SETTINGS_REGISTRY } from './SETTINGS_REGISTRY'
import type { SettingValue } from './SettingValue'

type Raw = Record<string, Record<string, unknown>>

/** The definition of a key, widened for code that handles every kind. */
export function settingDefinition(key: SettingKey): AnySettingDefinition {
  return SETTINGS_REGISTRY[key] as AnySettingDefinition
}

export function readSetting<K extends SettingKey>(
  settings: PlayerSettings,
  key: K,
): SettingValue<K> {
  const [section, field] = key.split('.') as [string, string]
  return (settings as unknown as Raw)[section]?.[field] as SettingValue<K>
}

/**
 * A copy of the settings with one value replaced, kept within the keyboard's cross-setting
 * limits (brief decision 44).
 */
export function withSetting<K extends SettingKey>(
  settings: PlayerSettings,
  key: K,
  value: SettingValue<K>,
): PlayerSettings {
  const [section, field] = key.split('.') as [keyof PlayerSettings, string]
  const next = { ...settings, [section]: { ...settings[section], [field]: value } }
  // Choosing a quality preset sets its cost settings (brief decision 110), however it's chosen.
  const render =
    key === 'render.quality' ? applyQualityPreset(next.render, next.render.quality) : next.render
  return { ...next, render, keyboard: constrainKeyboard(next.keyboard) }
}

/** A setting's default on a kind of device (brief decision 110). */
export function defaultValue(key: SettingKey, device: DeviceClass = 'desktop'): unknown {
  const def = settingDefinition(key)
  return device === 'tablet' && def.tabletDefault !== undefined ? def.tabletDefault : def.default
}

/**
 * True when a value counts as the default. Numbers within half a slider step count: defaults
 * such as 12/23.5 aren't on the step grid, so dragging back to them can't land exactly.
 */
export function isDefaultValue(
  key: SettingKey,
  value: unknown,
  device: DeviceClass = 'desktop',
): boolean {
  const def = settingDefinition(key)
  const fallback = defaultValue(key, device)
  if (def.kind === 'number') {
    return typeof value === 'number' && Math.abs(value - (fallback as number)) < def.step / 2
  }
  if (def.kind === 'color') {
    return typeof value === 'string' && value.toUpperCase() === (fallback as string).toUpperCase()
  }
  return value === fallback
}
