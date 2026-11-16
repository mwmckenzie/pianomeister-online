import { defineStore } from 'pinia'
import { ref, toRaw, watch } from 'vue'

import { constrainKeyboard } from '@/core/settings/constrainKeyboard'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import { loadSettings, storedSettings } from '@/core/settings/loadSettings'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

const STORAGE_KEY = 'pianomeister.settings'

/** Settings the panel edits in place: the same shape without `readonly`. */
type Editable<T> = { -readonly [K in keyof T]: T[K] extends object ? Editable<T[K]> : T[K] }

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

/** Player view settings, persisted to localStorage (versioned) until profiles arrive in milestone 7. */
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Editable<PlayerSettings>>(structuredClone(read()))

  watch(
    settings,
    (value) => {
      // Keep the keyboard within its cross-setting limits as the user edits (e.g. lowering the
      // black keys lowers their maximum press depth too).
      const limited = constrainKeyboard(value.keyboard)
      if (limited !== value.keyboard) Object.assign(value.keyboard, limited)
      write(toRaw(value))
    },
    { deep: true },
  )

  /** A plain, detached copy for the (non-reactive) engine. */
  function snapshot(): PlayerSettings {
    return structuredClone(toRaw(settings.value))
  }

  function reset(): void {
    settings.value = structuredClone(DEFAULT_SETTINGS)
  }

  /** Restores one section, e.g. "Reset to grand piano" for the keyboard. */
  function resetSection(section: keyof PlayerSettings): void {
    Object.assign(settings.value[section], structuredClone(DEFAULT_SETTINGS[section]))
  }

  return { settings, snapshot, reset, resetSection }
})
