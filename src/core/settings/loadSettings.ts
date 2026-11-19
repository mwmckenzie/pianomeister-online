import { readShortcutOverrides } from '../commands/readShortcutOverrides'
import type { ShortcutOverrides } from '../commands/ShortcutOverrides'
import { constrainKeyboard } from './constrainKeyboard'
import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import type { PlayerSettings } from './PlayerSettings'
import type { AnySettingDefinition } from './SettingDefinition'
import { SETTING_KEYS } from './SETTING_KEYS'
import { settingDefinition } from './settingValues'

/** Bump on every schema change and add a migration from the previous version. */
export const SETTINGS_VERSION = 5

type Raw = Record<string, unknown>

/**
 * Upgrades stored settings one version at a time. Each step returns the next version's shape;
 * keys a step doesn't mention are carried over, and keys that are new get their defaults when
 * the result is merged over DEFAULT_SETTINGS.
 */
const MIGRATIONS: Record<number, (settings: Raw) => Raw> = {
  // v2 adds the keyboard and render sections and new keys in highway, notes and effects.
  1: (settings) => settings,
  // v3 adds the audio, practice and appearance sections (brief decision 63).
  2: (settings) => settings,
  // v4: "Hide controls when idle" becomes a switch plus a delay in seconds (Off → switch off,
  // "2"/"3"/"5"/"10" → on after that many seconds); practice gains the tempo step.
  3: (settings) => {
    const appearance = isRecord(settings.appearance) ? settings.appearance : {}
    const old = appearance.hideControls
    if (typeof old !== 'string') return settings
    const seconds = Number(old)
    return {
      ...settings,
      appearance: {
        ...appearance,
        hideControls: old !== 'off',
        ...(Number.isFinite(seconds) ? { hideControlsAfter: seconds } : {}),
      },
    }
  },
  // v5 stores the keyboard shortcut overrides beside the settings (brief decision 88); a
  // migrated store has none.
  4: (settings) => settings,
}

const COLOR = /^#[0-9a-f]{6}$/i

/** The persisted shape: `{ version, settings, shortcuts }` (shortcuts from v5). */
export function storedSettings(
  settings: PlayerSettings,
  shortcuts: ShortcutOverrides = {},
): {
  readonly version: number
  readonly settings: PlayerSettings
  readonly shortcuts: ShortcutOverrides
} {
  return { version: SETTINGS_VERSION, settings, shortcuts }
}

/**
 * The shortcut overrides from stored settings (brief decision 88): none before v5, and none
 * from a newer version (like the settings themselves).
 */
export function loadShortcuts(raw: unknown): ShortcutOverrides {
  if (!isRecord(raw) || raw.version !== SETTINGS_VERSION) return {}
  return readShortcutOverrides(raw.shortcuts)
}

/**
 * Rebuilds settings from stored JSON. Older versions are migrated; stored values are merged
 * over the defaults, numbers are clamped to their ranges (and the keyboard to its cross-setting
 * limits, see constrainKeyboard), choices must be listed, wrong types
 * and malformed colours fall back to the default, and unknown keys are ignored. Settings from
 * an unknown (newer) version are discarded.
 */
export function loadSettings(raw: unknown): PlayerSettings {
  if (!isRecord(raw) || typeof raw.version !== 'number' || !isRecord(raw.settings)) {
    return DEFAULT_SETTINGS
  }
  let version = raw.version
  let stored: Raw = raw.settings
  while (version < SETTINGS_VERSION) {
    const migrate = MIGRATIONS[version]
    if (migrate === undefined) return DEFAULT_SETTINGS
    stored = migrate(stored)
    version++
  }
  if (version !== SETTINGS_VERSION) return DEFAULT_SETTINGS

  const out: Record<string, Raw> = {}
  for (const key of SETTING_KEYS) {
    const [section, field] = key.split('.') as [string, string]
    const source = isRecord(stored[section]) ? stored[section] : {}
    out[section] ??= {}
    out[section][field] = coerce(source[field], settingDefinition(key))
  }
  const settings = out as unknown as PlayerSettings
  // Limits that depend on other settings (black height vs thickness, press depths).
  return { ...settings, keyboard: constrainKeyboard(settings.keyboard) }
}

function coerce(value: unknown, def: AnySettingDefinition): unknown {
  switch (def.kind) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return def.default
      return Math.min(def.max, Math.max(def.min, value))
    case 'boolean':
      return typeof value === 'boolean' ? value : def.default
    case 'choice':
      return def.options.some((o) => o.value === value) ? value : def.default
    case 'color':
      return typeof value === 'string' && COLOR.test(value) ? value.toUpperCase() : def.default
  }
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
