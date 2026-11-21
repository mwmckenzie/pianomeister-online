import { readShortcutOverrides } from '../commands/readShortcutOverrides'
import type { ShortcutOverrides } from '../commands/ShortcutOverrides'
import { EMPTY_LOOKS } from '../looks/EMPTY_LOOKS'
import type { LooksState } from '../looks/LooksState'
import { readLooks } from '../looks/readLooks'
import { coerceSetting } from './coerceSetting'
import { constrainKeyboard } from './constrainKeyboard'
import { defaultSettings } from './DEFAULT_SETTINGS'
import type { DeviceClass } from './DeviceClass'
import type { PlayerSettings } from './PlayerSettings'
import { SETTING_KEYS } from './SETTING_KEYS'
import { defaultValue, settingDefinition } from './settingValues'

/** Bump on every schema change and add a migration from the previous version. */
export const SETTINGS_VERSION = 6

/** The first version that stored shortcut overrides (brief decision 88). */
const SHORTCUTS_SINCE = 5

type Raw = Record<string, unknown>

/**
 * Upgrades stored settings one version at a time. Each step returns the next version's shape;
 * keys a step doesn't mention are carried over, and keys that are new get their defaults when
 * the result is merged over the defaults.
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
  // v6 (brief decision 120): the pedal band becomes the pedal cage, whose fill keeps the
  // band's colour and opacity; everything else new gets its default.
  5: (settings) => {
    const colors = isRecord(settings.colors) ? settings.colors : {}
    const opacity = isRecord(settings.opacity) ? settings.opacity : {}
    const pedal = isRecord(settings.pedal) ? settings.pedal : {}
    return {
      ...settings,
      pedal: {
        ...pedal,
        ...('pedal' in colors ? { fillColor: colors.pedal } : {}),
        ...('pedal' in opacity ? { fillOpacity: opacity.pedal } : {}),
      },
    }
  },
}

/** The persisted shape: `{ version, settings, shortcuts, looks, deviceClass }`. */
export function storedSettings(
  settings: PlayerSettings,
  shortcuts: ShortcutOverrides = {},
  looks: LooksState = EMPTY_LOOKS,
  deviceClass: DeviceClass = 'desktop',
): {
  readonly version: number
  readonly settings: PlayerSettings
  readonly shortcuts: ShortcutOverrides
  readonly looks: LooksState
  readonly deviceClass: DeviceClass
} {
  return { version: SETTINGS_VERSION, settings, shortcuts, looks, deviceClass }
}

/**
 * The shortcut overrides from stored settings (brief decision 88): none before v5, and none
 * from a newer version (like the settings themselves).
 */
export function loadShortcuts(raw: unknown): ShortcutOverrides {
  if (!isKnownVersion(raw, SHORTCUTS_SINCE)) return {}
  return readShortcutOverrides(raw.shortcuts)
}

/** Saved looks (brief decision 121): none before v6 or from a newer version. */
export function loadLooks(raw: unknown): LooksState {
  if (!isKnownVersion(raw, 6)) return EMPTY_LOOKS
  return readLooks(raw.looks)
}

/**
 * The device class the stored defaults were chosen for, so reset and "modified" stay per
 * device (brief decision 110); `detected` when none is stored (first run, or before v6).
 */
export function loadDeviceClass(raw: unknown, detected: DeviceClass): DeviceClass {
  if (!isKnownVersion(raw, 6)) return detected
  return raw.deviceClass === 'tablet' || raw.deviceClass === 'desktop' ? raw.deviceClass : detected
}

/**
 * Rebuilds settings from stored JSON. Older versions are migrated; stored values are merged
 * over the defaults for `device`, numbers are clamped to their ranges (and the keyboard to its
 * cross-setting limits, see constrainKeyboard), choices must be listed, wrong types and
 * malformed colours fall back to the default, and unknown keys are ignored. Settings from an
 * unknown (newer) version are discarded.
 */
export function loadSettings(raw: unknown, device: DeviceClass = 'desktop'): PlayerSettings {
  const defaults = defaultSettings(device)
  if (!isRecord(raw) || typeof raw.version !== 'number' || !isRecord(raw.settings)) {
    return defaults
  }
  let version = raw.version
  let stored: Raw = raw.settings
  while (version < SETTINGS_VERSION) {
    const migrate = MIGRATIONS[version]
    if (migrate === undefined) return defaults
    stored = migrate(stored)
    version++
  }
  if (version !== SETTINGS_VERSION) return defaults

  const out: Record<string, Raw> = {}
  for (const key of SETTING_KEYS) {
    const [section, field] = key.split('.') as [string, string]
    const source = isRecord(stored[section]) ? stored[section] : {}
    out[section] ??= {}
    out[section][field] = coerceSetting(
      source[field],
      settingDefinition(key),
      defaultValue(key, device),
    )
  }
  const settings = out as unknown as PlayerSettings
  // Limits that depend on other settings (black height vs thickness, press depths).
  return { ...settings, keyboard: constrainKeyboard(settings.keyboard) }
}

function isKnownVersion(raw: unknown, since: number): raw is Raw {
  return (
    isRecord(raw) &&
    typeof raw.version === 'number' &&
    raw.version >= since &&
    raw.version <= SETTINGS_VERSION
  )
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
