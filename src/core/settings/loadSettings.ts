import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import type { PlayerSettings } from './PlayerSettings'
import { SETTING_RANGES } from './SETTING_RANGES'

/** Bump when a change would make old stored settings wrong; old ones are then discarded. */
export const SETTINGS_VERSION = 1

const COLOR = /^#[0-9a-f]{6}$/i

/** The persisted shape: `{ version, settings }`. */
export function storedSettings(settings: PlayerSettings): {
  readonly version: number
  readonly settings: PlayerSettings
} {
  return { version: SETTINGS_VERSION, settings }
}

/**
 * Rebuilds settings from stored JSON: stored values are merged over the defaults, numbers are
 * clamped to their ranges, wrong types and malformed colours fall back to the default, and
 * unknown keys are ignored. Anything from another schema version is discarded.
 */
export function loadSettings(raw: unknown): PlayerSettings {
  if (!isRecord(raw) || raw.version !== SETTINGS_VERSION || !isRecord(raw.settings)) {
    return DEFAULT_SETTINGS
  }
  const stored = raw.settings
  const out: Record<string, Record<string, unknown>> = {}
  for (const [section, defaults] of Object.entries(DEFAULT_SETTINGS)) {
    const source = isRecord(stored[section]) ? stored[section] : {}
    const ranges: Record<string, readonly [number, number]> =
      (SETTING_RANGES as Record<string, Record<string, readonly [number, number]>>)[section] ?? {}
    const merged: Record<string, unknown> = {}
    for (const [key, fallback] of Object.entries(defaults as Record<string, unknown>)) {
      merged[key] = coerce(source[key], fallback, ranges[key])
    }
    out[section] = merged
  }
  return out as unknown as PlayerSettings
}

function coerce(value: unknown, fallback: unknown, range?: readonly [number, number]): unknown {
  if (typeof fallback === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    return range === undefined ? value : Math.min(range[1], Math.max(range[0], value))
  }
  if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback
  if (typeof fallback === 'string') {
    return typeof value === 'string' && COLOR.test(value) ? value.toUpperCase() : fallback
  }
  return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
