import { EMPTY_COLOUR_SETS } from '../color/EMPTY_COLOUR_SETS'
import type { NoteColourSets } from '../color/NoteColourSets'
import { readColourSets } from '../color/readColourSets'
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
export const SETTINGS_VERSION = 11

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
  // v7 (brief decision 112): the old Neon fill (dark inside, bright border) is now Outline,
  // and Neon a new fill; the shared stripe width and drift move into the head, sustain and
  // pedal stripe groups. The pedal takes the width only where it was changed from the old
  // default, so its new, wider default (no moiré) applies otherwise.
  6: (settings) => {
    const noteStyle = isRecord(settings.noteStyle) ? settings.noteStyle : {}
    const pedal = isRecord(settings.pedal) ? settings.pedal : {}
    const outline = (fill: unknown) => (fill === 'neon' ? 'outline' : fill)
    const { stripeWidth: width, stripeDrift: drift, ...style } = noteStyle
    const shape = (prefix: string, keepWidth: boolean) => ({
      ...(width !== undefined && keepWidth ? { [`${prefix}Width`]: width } : {}),
      ...(drift !== undefined ? { [`${prefix}Drift`]: drift } : {}),
    })
    return {
      ...settings,
      noteStyle: {
        ...style,
        headFill: outline(style.headFill),
        sustainFill: outline(style.sustainFill),
        ...shape('headStripe', true),
        ...shape('sustainStripe', true),
      },
      pedal: {
        ...pedal,
        fill: outline(pedal.fill),
        ...shape('stripe', width !== OLD_STRIPE_WIDTH),
      },
    }
  },
  // v8 (brief decision 112): Glass is replaced by Crystal, Bubbles and Liquid; a Glass fill
  // becomes Crystal (the closest: a solid, tinted, still body). "Smoke (round 1)", offered
  // only while candidates were compared, is the shipped Smoke.
  7: (settings) => {
    const noteStyle = isRecord(settings.noteStyle) ? settings.noteStyle : {}
    const pedal = isRecord(settings.pedal) ? settings.pedal : {}
    const renamed = (fill: unknown) =>
      fill === 'glass' ? 'crystal' : fill === 'smokeRound1' ? 'smoke' : fill
    return {
      ...settings,
      noteStyle: {
        ...noteStyle,
        headFill: renamed(noteStyle.headFill),
        sustainFill: renamed(noteStyle.sustainFill),
      },
      pedal: { ...pedal, fill: renamed(pedal.fill) },
    }
  },
  // v9 (milestone 9.2): black-lane notes sit on the highway again, so the black lift and its
  // mode go; the one head height becomes the white note height (black gets its own, new). The
  // contact shadow becomes the black note outline: its switch carries over, and its strength
  // only where it was changed from the old default, so the new, stronger default applies
  // otherwise.
  8: (settings) => {
    if (!isRecord(settings.notes)) return settings
    const {
      blackLiftMode: _mode,
      blackLift: _lift,
      headHeight,
      contactShadow,
      shadowStrength,
      ...notes
    } = settings.notes
    return {
      ...settings,
      notes: {
        ...notes,
        ...(headHeight !== undefined ? { whiteHeadHeight: headHeight } : {}),
        ...(contactShadow !== undefined ? { blackOutline: contactShadow } : {}),
        ...(shadowStrength !== undefined && shadowStrength !== OLD_SHADOW_STRENGTH
          ? { blackOutlineStrength: shadowStrength }
          : {}),
      },
    }
  },
  // v10 (milestone 10.5) adds the hand detection settings.
  9: (settings) => settings,
  // v11 (milestone 10.6) stores the note colour sets beside the settings; looks carry a copy.
  10: (settings) => settings,
}

/** The contact shadow's default strength before v9. */
const OLD_SHADOW_STRENGTH = 0.45

/** The shared stripe width's default before v7. */
const OLD_STRIPE_WIDTH = 0.35

/**
 * Migrates a saved look's values (flat `section.field` keys) stored with an older version,
 * through the same steps as stored settings.
 */
export function migrateLookValues(values: Raw, from: number): Raw {
  const nested: Record<string, Raw> = {}
  for (const [key, value] of Object.entries(values)) {
    const [section, field] = key.split('.')
    if (section === undefined || field === undefined) continue
    nested[section] ??= {}
    nested[section][field] = value
  }
  let stored: Raw = nested
  for (let version = from; version < SETTINGS_VERSION; version++) {
    const migrate = MIGRATIONS[version]
    if (migrate !== undefined) stored = migrate(stored)
  }
  const flat: Raw = {}
  for (const [section, fields] of Object.entries(stored)) {
    if (!isRecord(fields)) continue
    for (const [field, value] of Object.entries(fields)) flat[`${section}.${field}`] = value
  }
  return flat
}

/**
 * The persisted shape: `{ version, settings, shortcuts, looks, deviceClass, noteColourSets }`. `looks.active` is
 * the picked look; saved looks live in the database (milestone 9.1), so `looks.saved` only
 * holds looks still waiting to move there.
 */
export function storedSettings(
  settings: PlayerSettings,
  shortcuts: ShortcutOverrides = {},
  looks: LooksState = EMPTY_LOOKS,
  deviceClass: DeviceClass = 'desktop',
  noteColourSets: NoteColourSets = EMPTY_COLOUR_SETS,
): {
  readonly version: number
  readonly settings: PlayerSettings
  readonly shortcuts: ShortcutOverrides
  readonly looks: LooksState
  readonly deviceClass: DeviceClass
  readonly noteColourSets: NoteColourSets
} {
  return { version: SETTINGS_VERSION, settings, shortcuts, looks, deviceClass, noteColourSets }
}

/**
 * The shortcut overrides from stored settings (brief decision 88): none before v5, and none
 * from a newer version (like the settings themselves).
 */
export function loadShortcuts(raw: unknown): ShortcutOverrides {
  if (!isKnownVersion(raw, SHORTCUTS_SINCE)) return {}
  return readShortcutOverrides(raw.shortcuts)
}

/**
 * The picked look, and saved looks still in localStorage from before milestone 9.1 (they move
 * to the database): none before v6 or from a newer version.
 */
export function loadLooks(raw: unknown): LooksState {
  if (!isKnownVersion(raw, 6)) return EMPTY_LOOKS
  return readLooks(raw.looks, (values) => migrateLookValues(values, raw.version as number))
}

/** The note colour sets (milestone 10.6): none before v11 or from a newer version. */
export function loadColourSets(raw: unknown): NoteColourSets {
  return isKnownVersion(raw, 11) ? readColourSets(raw.noteColourSets) : EMPTY_COLOUR_SETS
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
