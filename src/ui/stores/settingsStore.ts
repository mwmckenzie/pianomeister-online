import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import { loadSettings, storedSettings } from '@/core/settings/loadSettings'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'
import type { SettingGroup } from '@/core/settings/SettingGroup'
import {
  changedCount as countChanged,
  resetGroup as resetGroupValues,
  restoreValues,
  type SettingValues,
} from '@/core/settings/settingGroups'
import type { SettingKey } from '@/core/settings/SettingKey'
import type { SettingValue } from '@/core/settings/SettingValue'
import { isDefaultValue, readSetting, withSetting } from '@/core/settings/settingValues'

const STORAGE_KEY = 'pianomeister.settings'

function read(): PlayerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return loadSettings(raw === null ? null : JSON.parse(raw))
  } catch {
    // Unreadable storage (private mode, corrupt JSON): fall back to defaults.
    return DEFAULT_SETTINGS
  }
}

function write(settings: PlayerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSettings(settings)))
  } catch {
    // Storage full or blocked: settings still apply for this session.
  }
}

/**
 * App settings, persisted to localStorage (versioned) until profiles arrive in milestone 7.
 * The value is immutable plain data: every change replaces it through `set`, which applies the
 * keyboard's cross-setting limits, so the engine can take it without unwrapping proxies.
 */
export const useSettingsStore = defineStore('settings', () => {
  const settings = shallowRef<PlayerSettings>(read())

  watch(settings, write)

  function get<K extends SettingKey>(key: K): SettingValue<K> {
    return readSetting(settings.value, key)
  }

  function set<K extends SettingKey>(key: K, value: SettingValue<K>): void {
    settings.value = withSetting(settings.value, key, value)
  }

  function isDefault(key: SettingKey): boolean {
    return isDefaultValue(key, readSetting(settings.value, key))
  }

  function reset(key: SettingKey): void {
    settings.value = withSetting(settings.value, key, readSetting(DEFAULT_SETTINGS, key))
  }

  /** Resets a section, tab or the sidebar; returns the replaced values for Undo. */
  function resetGroup(group: SettingGroup): SettingValues {
    const { settings: next, previous } = resetGroupValues(settings.value, group)
    settings.value = next
    return previous
  }

  function restore(values: SettingValues): void {
    settings.value = restoreValues(settings.value, values)
  }

  function changedCount(group: SettingGroup): number {
    return countChanged(settings.value, group)
  }

  /** A detached copy for the (non-reactive) engine. */
  function snapshot(): PlayerSettings {
    return structuredClone(settings.value)
  }

  return { settings, get, set, isDefault, reset, resetGroup, restore, changedCount, snapshot }
})
