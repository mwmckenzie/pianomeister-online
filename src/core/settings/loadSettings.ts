import { constrainKeyboard } from './constrainKeyboard'
import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import type { PlayerSettings } from './PlayerSettings'
import { SETTING_CHOICES } from './SETTING_CHOICES'
import { SETTING_RANGES } from './SETTING_RANGES'

/** Bump on every schema change and add a migration from the previous version. */
export const SETTINGS_VERSION = 2

type Raw = Record<string, unknown>

/**
 * Upgrades stored settings one version at a time. Each step returns the next version's shape;
 * keys a step doesn't mention are carried over, and keys that are new get their defaults when
 * the result is merged over DEFAULT_SETTINGS.
 */
const MIGRATIONS: Record<number, (settings: Raw) => Raw> = {
  // v2 adds the keyboard and render sections and new keys in highway, notes and effects.
  1: (settings) => settings,
}

const COLOR = /^#[0-9a-f]{6}$/i

/** The persisted shape: `{ version, settings }`. */
export function storedSettings(settings: PlayerSettings): {
  readonly version: number
  readonly settings: PlayerSettings
} {
  return { version: SETTINGS_VERSION, settings }
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

  const ranges = SETTING_RANGES as Record<string, Record<string, readonly [number, number]>>
  const choices = SETTING_CHOICES as Record<string, Record<string, readonly string[]>>
  const out: Record<string, Raw> = {}
  for (const [section, defaults] of Object.entries(DEFAULT_SETTINGS)) {
    const source = isRecord(stored[section]) ? stored[section] : {}
    const merged: Raw = {}
    for (const [key, fallback] of Object.entries(defaults as Raw)) {
      merged[key] = coerce(source[key], fallback, ranges[section]?.[key], choices[section]?.[key])
    }
    out[section] = merged
  }
  const settings = out as unknown as PlayerSettings
  // Limits that depend on other settings (black height vs thickness, press depths).
  return { ...settings, keyboard: constrainKeyboard(settings.keyboard) }
}

function coerce(
  value: unknown,
  fallback: unknown,
  range?: readonly [number, number],
  choices?: readonly string[],
): unknown {
  if (typeof fallback === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    return range === undefined ? value : Math.min(range[1], Math.max(range[0], value))
  }
  if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback
  if (typeof fallback === 'string') {
    if (typeof value !== 'string') return fallback
    if (choices !== undefined) return choices.includes(value) ? value : fallback
    return COLOR.test(value) ? value.toUpperCase() : fallback
  }
  return fallback
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
