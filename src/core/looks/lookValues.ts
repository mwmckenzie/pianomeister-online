import type { SavedColours } from '../color/SavedColours'
import type { NoteColourSets } from '../color/NoteColourSets'
import { EMPTY_COLOUR_SETS } from '../color/EMPTY_COLOUR_SETS'
import type { DeviceClass } from '../settings/DeviceClass'
import type { PlayerSettings } from '../settings/PlayerSettings'
import { restoreValues, type SettingValues } from '../settings/settingGroups'
import type { SettingKey } from '../settings/SettingKey'
import {
  defaultValue,
  isDefaultValue,
  readSetting,
  settingDefinition,
} from '../settings/settingValues'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import type { Look } from './Look'
import { LOOK_KEYS } from './LOOK_KEYS'
import type { LooksState } from './LooksState'

/** The current playfield setup as a look (brief decision 121); never device cost. */
export function captureLook(
  settings: PlayerSettings,
  id: string,
  name: string,
  now = new Date().toISOString(),
  createdAt = now,
): Look {
  return {
    id,
    name,
    builtIn: false,
    createdAt,
    updatedAt: now,
    values: Object.fromEntries(LOOK_KEYS.map((key) => [key, readSetting(settings, key)])),
  }
}

/** A look's value for a key: its own, or the device's default when it has none. */
export function lookValue(look: Look, key: SettingKey, device: DeviceClass = 'desktop'): unknown {
  return key in look.values ? look.values[key] : defaultValue(key, device)
}

/**
 * The settings a look gives on top of `base`: every look key set from the look (missing ones
 * from the device's defaults), device cost kept from `base`. Pure — the user's settings are
 * only written by whoever stores the result, so a playlist or a bookmark (milestone 9.5 and
 * later) can use it as a temporary overlay.
 */
export function lookSettings(
  base: PlayerSettings,
  look: Look,
  device: DeviceClass = 'desktop',
): PlayerSettings {
  return restoreValues(base, new Map(LOOK_KEYS.map((key) => [key, lookValue(look, key, device)])))
}

/** Settings with the look applied; `previous` holds what it replaced, for Undo. */
export function applyLook(
  settings: PlayerSettings,
  look: Look,
  device: DeviceClass = 'desktop',
): { readonly settings: PlayerSettings; readonly previous: SettingValues } {
  const previous = new Map<SettingKey, unknown>(
    LOOK_KEYS.map((key) => [key, readSetting(settings, key)]),
  )
  return { settings: lookSettings(settings, look, device), previous }
}

/** True when two values of a key count as the same (numbers within half a slider step). */
export function sameSettingValue(key: SettingKey, a: unknown, b: unknown): boolean {
  const def = settingDefinition(key)
  if (def.kind === 'number') {
    return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < def.step / 2
  }
  if (def.kind === 'color') return String(a).toUpperCase() === String(b).toUpperCase()
  if (def.kind === 'savedColours') return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

/**
 * True when the settings no longer match the look ("⟨Look⟩ · modified"), comparing every look
 * key the way the look applies it (missing keys as the device's defaults). A look's copy of a
 * colour set is left out: editing the set would mark every look that uses it.
 */
export function isLookModified(
  settings: PlayerSettings,
  look: Look,
  device: DeviceClass = 'desktop',
): boolean {
  return LOOK_KEYS.some(
    (key) =>
      key !== 'notes.paletteSaved' &&
      !sameSettingValue(key, readSetting(settings, key), lookValue(look, key, device)),
  )
}

/**
 * True when two looks give the same picture (names, ids and dates aside). Their copies of a
 * colour set only count while that set is missing here.
 */
export function sameLookValues(
  a: Look,
  b: Look,
  sets: NoteColourSets = EMPTY_COLOUR_SETS,
): boolean {
  const id = lookValue(a, 'notes.palette')
  const copied = !sets.custom.some((set) => set.id === id)
  return LOOK_KEYS.every((key) =>
    key === 'notes.paletteSaved'
      ? !copied || savedHexes(a) === savedHexes(b)
      : sameSettingValue(key, lookValue(a, key), lookValue(b, key)),
  )
}

/** The copied colours alone: renaming a set doesn't change the picture. */
function savedHexes(look: Look): string {
  const saved = lookValue(look, 'notes.paletteSaved') as SavedColours | null
  return saved?.colours.join() ?? ''
}

/** Every look the picker offers: built-in first, then saved ones in the order saved. */
export function allLooks(state: LooksState): readonly Look[] {
  return [...BUILT_IN_LOOKS, ...state.saved]
}

/** The picked look, if it still exists. */
export function activeLook(state: LooksState): Look | null {
  return allLooks(state).find((look) => look.id === state.active) ?? null
}

/** True when every look setting is at its default (nothing to call "modified" yet). */
export function isDefaultLook(settings: PlayerSettings, device: DeviceClass = 'desktop'): boolean {
  return LOOK_KEYS.every((key) => isDefaultValue(key, readSetting(settings, key), device))
}

/** A look name not used yet: "My look", "My look 2", … */
export function nextLookName(state: LooksState, base = 'My look'): string {
  const names = new Set(allLooks(state).map((look) => look.name.toLowerCase()))
  if (!names.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) {
    const name = `${base} ${n}`
    if (!names.has(name.toLowerCase())) return name
  }
}
