import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { addSet, removeSet } from '@/core/color/colourSetEdits'
import { EMPTY_COLOUR_SETS } from '@/core/color/EMPTY_COLOUR_SETS'
import { freeSetName } from '@/core/color/freeSetName'
import { isCustomSetId } from '@/core/color/isNoteColourSetId'
import type { NoteColourSets } from '@/core/color/NoteColourSets'
import type { SavedColours } from '@/core/color/SavedColours'
import { savedColoursOf } from '@/core/color/savedColoursOf'
import { EMPTY_LOOKS } from '@/core/looks/EMPTY_LOOKS'
import type { Look } from '@/core/looks/Look'
import { LOOK_KEYS } from '@/core/looks/LOOK_KEYS'
import type { LooksState } from '@/core/looks/LooksState'
import { withSavedColours } from '@/core/looks/withSavedColours'
import type { CustomSetId } from '@/core/settings/CustomSetId'
import type { NoteColourSetId } from '@/core/settings/NoteColourSetId'
import { defaultSettings } from '@/core/settings/DEFAULT_SETTINGS'
import type { DeviceClass } from '@/core/settings/DeviceClass'
import { applyShortcutEdit } from '@/core/commands/applyShortcutEdit'
import type { Binding } from '@/core/commands/Binding'
import type { CommandId } from '@/core/commands/CommandId'
import { formatBinding } from '@/core/commands/formatBinding'
import { metaKeyLabel } from '@/core/commands/metaKeyLabel'
import { effectiveBindings } from '@/core/commands/shortcutBindings'
import type { ShortcutEdit } from '@/core/commands/ShortcutEdit'
import type { ShortcutOverrides } from '@/core/commands/ShortcutOverrides'
import {
  loadColourSets,
  loadDeviceClass,
  loadLooks,
  loadSettings,
  loadShortcuts,
  storedSettings,
} from '@/core/settings/loadSettings'
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

import { Looks } from '@/data/Looks'

import { appDatabase } from './appDatabase'
import { detectDeviceClass } from './detectDeviceClass'

const STORAGE_KEY = 'pianomeister.settings'

interface Stored {
  readonly settings: PlayerSettings
  readonly shortcuts: ShortcutOverrides
  /** The picked look, and saved looks not yet moved to the database. */
  readonly looks: LooksState
  readonly deviceClass: DeviceClass
  readonly noteColourSets: NoteColourSets
}

function read(): Stored {
  const detected = detectDeviceClass()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw === null ? null : JSON.parse(raw)
    const deviceClass = loadDeviceClass(parsed, detected)
    return {
      settings: loadSettings(parsed, deviceClass),
      shortcuts: loadShortcuts(parsed),
      looks: loadLooks(parsed),
      deviceClass,
      noteColourSets: loadColourSets(parsed),
    }
  } catch {
    // Unreadable storage (private mode, corrupt JSON): fall back to defaults.
    return {
      settings: defaultSettings(detected),
      shortcuts: {},
      looks: EMPTY_LOOKS,
      deviceClass: detected,
      noteColourSets: EMPTY_COLOUR_SETS,
    }
  }
}

function write(stored: Stored): void {
  try {
    const { settings, shortcuts, looks, deviceClass, noteColourSets } = stored
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(storedSettings(settings, shortcuts, looks, deviceClass, noteColourSets)),
    )
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
 * App settings, keyboard shortcut overrides and looks, device-wide. Settings, shortcuts and
 * the picked look persist to localStorage (versioned, read before the first frame); saved looks
 * live in the database (milestone 9.1) and arrive a moment after start. The value is immutable plain data: every change replaces it through `set`, which
 * applies the keyboard's cross-setting limits, so the engine can take it without unwrapping
 * proxies.
 */
export const useSettingsStore = defineStore('settings', () => {
  const stored = read()
  const settings = shallowRef<PlayerSettings>(stored.settings)
  const shortcuts = shallowRef<ShortcutOverrides>(stored.shortcuts)
  const looks = shallowRef<LooksState>(stored.looks)
  /** The player's note colour sets (milestone 10.6). */
  const noteColourSets = shallowRef<NoteColourSets>(stored.noteColourSets)
  /** Saved looks from localStorage (before milestone 9.1) still waiting to move to the database. */
  let unmoved: readonly Look[] = stored.looks.saved
  /** The device class the defaults are for (brief decision 110); fixed once stored. */
  const deviceClass = stored.deviceClass
  const layoutMap = shallowRef<ReadonlyMap<string, string> | null>(null)
  void readLayoutMap().then((map) => (layoutMap.value = map))

  /**
   * The listening overlay (milestone 9.5): while a playlist plays, `settings` shows its look on
   * top of the user's own; the user's own look values wait here and are what's stored. App
   * settings changed meanwhile (not look keys) are the user's and stay when listening ends.
   */
  const overlayBase = shallowRef<PlayerSettings | null>(null)
  const overlayActive = computed(() => overlayBase.value !== null)

  /** The user's own settings: under an overlay, its look keys from before it. */
  function ownSettings(): PlayerSettings {
    const base = overlayBase.value
    if (base === null) return settings.value
    return restoreValues(settings.value, new Map(LOOK_KEYS.map((k) => [k, readSetting(base, k)])))
  }

  /** Shows `next` (the user's settings with a look applied) without storing it. */
  function setOverlay(next: PlayerSettings): void {
    if (overlayBase.value === null) overlayBase.value = settings.value
    settings.value = next
  }

  /** Ends the overlay: the user's own look values come back, exactly as they were. */
  function endOverlay(): void {
    if (overlayBase.value === null) return
    const own = ownSettings()
    overlayBase.value = null
    settings.value = own
  }

  /**
   * A benchmark run's settings (milestone 11): everything, device cost included, is the run's
   * until it ends; what is stored stays the user's.
   */
  const benchBase = shallowRef<PlayerSettings | null>(null)

  function setBench(next: PlayerSettings): void {
    benchBase.value ??= ownSettings()
    overlayBase.value = null
    settings.value = next
  }

  function endBench(): void {
    const base = benchBase.value
    if (base === null) return
    benchBase.value = null
    overlayBase.value = null
    settings.value = base
  }

  function persist(): void {
    write({
      settings: benchBase.value ?? ownSettings(),
      shortcuts: shortcuts.value,
      looks: { active: looks.value.active, saved: unmoved },
      deviceClass,
      noteColourSets: noteColourSets.value,
    })
  }
  watch([settings, shortcuts, looks, noteColourSets], persist)

  let repository: Looks | null = null
  const savedLooks = (): Looks => (repository ??= new Looks(appDatabase()))

  /** Moves looks out of localStorage (only once the database has them), then lists them all. */
  async function reloadLooks(): Promise<void> {
    try {
      if (unmoved.length > 0) {
        await savedLooks().adopt(unmoved)
        unmoved = []
        persist()
      }
      const saved = await savedLooks().list()
      looks.value = { ...looks.value, saved }
    } catch (error) {
      // No database (private mode, blocked storage): looks stay as read for this session.
      console.error('Looks could not be loaded', error)
    }
  }
  void reloadLooks()

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
    return isDefaultValue(key, readSetting(settings.value, key), deviceClass)
  }

  function reset(key: SettingKey): void {
    settings.value = withSetting(
      settings.value,
      key,
      readSetting(defaultSettings(deviceClass), key),
    )
  }

  /** Resets a section, tab or the sidebar; returns the replaced values for Undo. */
  function resetGroup(group: SettingGroup): SettingValues {
    const { settings: next, previous } = resetGroupValues(settings.value, group, deviceClass)
    settings.value = next
    return previous
  }

  function restore(values: SettingValues): void {
    settings.value = restoreValues(settings.value, values)
  }

  function changedCount(group: SettingGroup): number {
    return countChanged(settings.value, group, deviceClass) + changedSets(group)
  }

  /** Built-in colour sets changed by the player count in Appearance and its section. */
  function changedSets(group: SettingGroup): number {
    return resetsColourSets(group) ? Object.keys(noteColourSets.value.overrides).length : 0
  }

  /** Whether a group's reset also clears the changes to built-in colour sets. */
  function resetsColourSets(group: SettingGroup): boolean {
    return (
      (group.kind === 'tab' && group.id === 'appearance') ||
      (group.kind === 'section' && group.id === 'noteColours')
    )
  }

  function setColourSets(next: NoteColourSets): void {
    noteColourSets.value = next
  }

  /** Puts values on screen and, under a listening overlay, in the user's own settings too. */
  function restoreEverywhere(change: (notes: PlayerSettings['notes']) => SettingValues): void {
    const base = overlayBase.value
    if (base !== null) overlayBase.value = restoreValues(base, change(base.notes))
    settings.value = restoreValues(settings.value, change(settings.value.notes))
  }

  /** Picks the set the playfield uses, with the copy its look carries. */
  function chooseColourSet(id: NoteColourSetId): void {
    const { paletteSaved } = settings.value.notes
    const saved = savedColoursOf(noteColourSets.value, id, paletteSaved)
    settings.value = restoreValues(
      settings.value,
      new Map<SettingKey, unknown>([
        ['notes.palette', id],
        ['notes.paletteSaved', saved],
      ]),
    )
  }

  /**
   * Deletes a custom set. Looks using it first take its colours as they are now (the set may have
   * changed since they were saved), so nothing changes colour.
   */
  function deleteColourSet(id: CustomSetId): void {
    const sets = noteColourSets.value
    restoreEverywhere((notes) =>
      notes.palette === id
        ? new Map([['notes.paletteSaved', savedColoursOf(sets, id, notes.paletteSaved)]])
        : new Map(),
    )
    setLooks({
      ...looks.value,
      saved: looks.value.saved.map((look) =>
        look.values['notes.palette'] === id ? withSavedColours(look, sets) : look,
      ),
    })
    noteColourSets.value = removeSet(sets, id)
  }

  /**
   * "Save as a set": the missing set on screen becomes a custom set again, under its own id so
   * every look that used it follows. If another saved look has other colours under that id, only
   * this look moves, to a new id.
   */
  function saveMissingSet(): void {
    const { palette, paletteSaved } = settings.value.notes
    if (!isCustomSetId(palette) || paletteSaved === null) return
    const sets = noteColourSets.value
    if (sets.custom.some((set) => set.id === palette)) return
    const { active } = looks.value
    const hexes = paletteSaved.colours.join()
    const copyOf = (look: Look) =>
      (look.values['notes.paletteSaved'] as SavedColours | null | undefined)?.colours.join()
    const uses = (look: Look) => look.values['notes.palette'] === palette
    const clash = looks.value.saved.some((look) => uses(look) && copyOf(look) !== hexes)
    const id: CustomSetId = clash ? `custom-${crypto.randomUUID()}` : palette
    noteColourSets.value = addSet(sets, {
      id,
      name: freeSetName(sets, paletteSaved.name),
      colours: paletteSaved.colours,
    })
    if (!clash) return
    restoreEverywhere((notes) =>
      notes.palette === palette && notes.paletteSaved?.colours.join() === hexes
        ? new Map([['notes.palette', id]])
        : new Map(),
    )
    setLooks({
      ...looks.value,
      saved: looks.value.saved.map((look) =>
        look.id === active && uses(look) && copyOf(look) === hexes
          ? { ...look, values: { ...look.values, 'notes.palette': id } }
          : look,
      ),
    })
  }

  /** Replaces settings wholesale (e.g. applying a look); the caller keeps what Undo needs. */
  function replace(next: PlayerSettings): void {
    settings.value = next
  }

  /**
   * Replaces the looks state (pick, save, rename, delete, import, and Undo of each); saved looks
   * that changed are written to the database and removed ones deleted.
   */
  function setLooks(next: LooksState): void {
    const before = new Map(looks.value.saved.map((look) => [look.id, look]))
    const after = new Set(next.saved.map((look) => look.id))
    looks.value = next
    const writes = [
      ...next.saved
        .filter((look) => before.get(look.id) !== look)
        .map((look) => savedLooks().put(look)),
      ...[...before.keys()].filter((id) => !after.has(id)).map((id) => savedLooks().delete(id)),
    ]
    void Promise.all(writes).catch((error: unknown) => console.error('Looks not saved', error))
  }

  /** A detached copy for the (non-reactive) engine. */
  function snapshot(): PlayerSettings {
    return structuredClone(settings.value)
  }

  return {
    settings,
    shortcuts,
    looks,
    noteColourSets,
    setColourSets,
    resetsColourSets,
    chooseColourSet,
    deleteColourSet,
    saveMissingSet,
    deviceClass,
    bindings,
    get,
    set,
    isDefault,
    reset,
    resetGroup,
    restore,
    changedCount,
    replace,
    setLooks,
    reloadLooks,
    snapshot,
    overlayActive,
    ownSettings,
    setOverlay,
    endOverlay,
    setBench,
    endBench,
    editShortcuts,
    restoreShortcuts,
    keyLabel,
    shortcutLabel,
  }
})
