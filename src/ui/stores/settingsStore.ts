import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import { applyShortcutEdit } from '@/core/commands/applyShortcutEdit'
import type { Binding } from '@/core/commands/Binding'
import type { CommandId } from '@/core/commands/CommandId'
import { formatBinding } from '@/core/commands/formatBinding'
import { metaKeyLabel } from '@/core/commands/metaKeyLabel'
import { effectiveBindings } from '@/core/commands/shortcutBindings'
import type { ShortcutEdit } from '@/core/commands/ShortcutEdit'
import type { ShortcutOverrides } from '@/core/commands/ShortcutOverrides'
import { loadSettings, loadShortcuts, storedSettings } from '@/core/settings/loadSettings'
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

function read(): { settings: PlayerSettings; shortcuts: ShortcutOverrides } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw === null ? null : JSON.parse(raw)
    return { settings: loadSettings(parsed), shortcuts: loadShortcuts(parsed) }
  } catch {
    // Unreadable storage (private mode, corrupt JSON): fall back to defaults.
    return { settings: DEFAULT_SETTINGS, shortcuts: {} }
  }
}

function write(settings: PlayerSettings, shortcuts: ShortcutOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSettings(settings, shortcuts)))
  } catch {
    // Storage full or blocked: settings still apply for this session.
  }
}

/** What physical keys type on this keyboard (Chromium only; null elsewhere: US names). */
/** The platform's name for the Meta key, read once (decision 87). */
const META_LABEL = metaKeyLabel(
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform,
)

async function readLayoutMap(): Promise<ReadonlyMap<string, string> | null> {
  const keyboard = (
    navigator as Navigator & {
      keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> }
    }
  ).keyboard
  try {
    return (await keyboard?.getLayoutMap?.()) ?? null
  } catch {
    return null
  }
}

/**
 * App settings and keyboard shortcut overrides, device-wide, persisted to localStorage
 * (versioned). The value is immutable plain data: every change replaces it through `set`, which
 * applies the keyboard's cross-setting limits, so the engine can take it without unwrapping
 * proxies.
 */
export const useSettingsStore = defineStore('settings', () => {
  const stored = read()
  const settings = shallowRef<PlayerSettings>(stored.settings)
  const shortcuts = shallowRef<ShortcutOverrides>(stored.shortcuts)
  const layoutMap = shallowRef<ReadonlyMap<string, string> | null>(null)
  void readLayoutMap().then((map) => (layoutMap.value = map))

  watch([settings, shortcuts], () => write(settings.value, shortcuts.value))

  /** Every command's keys in effect (brief decision 88). */
  const bindings = computed(() => effectiveBindings(shortcuts.value))

  /** Applies one Shortcuts-tab edit; returns the overrides before it, for Undo. */
  function editShortcuts(edit: ShortcutEdit): ShortcutOverrides {
    const { overrides, previous } = applyShortcutEdit(shortcuts.value, edit)
    shortcuts.value = overrides
    return previous
  }

  function restoreShortcuts(overrides: ShortcutOverrides): void {
    shortcuts.value = overrides
  }

  /** How a key is written in this app on this keyboard (decision 87). */
  function keyLabel(binding: Binding): string {
    return formatBinding(binding, layoutMap.value ?? undefined, META_LABEL)
  }

  /** A command's first key as a hint ("B"), or "" when it has none. */
  function shortcutLabel(id: CommandId): string {
    const first = bindings.value.get(id)?.[0]
    return first === undefined ? '' : keyLabel(first)
  }

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

  return {
    settings,
    shortcuts,
    bindings,
    get,
    set,
    isDefault,
    reset,
    resetGroup,
    restore,
    changedCount,
    snapshot,
    editShortcuts,
    restoreShortcuts,
    keyLabel,
    shortcutLabel,
  }
})
