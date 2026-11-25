import { computed, type Ref } from 'vue'

import { BUILT_IN_COLOUR_SETS } from '@/core/color/BUILT_IN_COLOUR_SETS'
import { isSetModified } from '@/core/color/colourSetEdits'
import { isCustomSetId } from '@/core/color/isNoteColourSetId'
import { basePaletteColors, notePaletteColors } from '@/core/color/notePaletteColors'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import type { NoteColourSetId } from '@/core/settings/NoteColourSetId'

import { useSettingsStore } from '../stores/settingsStore'

/** The sets as the editor lists them, and the selected one (milestone 10.6). */
export function useColourSets(selected: Ref<NoteColourSetId>) {
  const settings = useSettingsStore()

  /** Where Mono and Two-tone take their colours: the look on screen if it uses the set. */
  const lookFor = (id: NoteColourSetId) =>
    settings.settings.notes.palette === id ? settings.settings.notes : DEFAULT_SETTINGS.notes

  const entry = (id: NoteColourSetId, name: string) => ({
    id,
    name,
    modified: isSetModified(settings.noteColourSets, id),
    colours: notePaletteColors(
      { ...lookFor(id), palette: id, paletteSaved: null },
      settings.noteColourSets,
    ),
  })
  const builtIn = computed(() => BUILT_IN_COLOUR_SETS.map((set) => entry(set.id, set.name)))
  const custom = computed(() =>
    settings.noteColourSets.custom.map((set) => entry(set.id, set.name)),
  )
  const current = computed(
    () =>
      [...builtIn.value, ...custom.value].find((set) => set.id === selected.value) ??
      entry('default', 'Default'),
  )
  /** The selected set's colours without changes (a custom set's are its own). */
  const base = computed(() => {
    const { id, colours } = current.value
    return isCustomSetId(id) ? colours : basePaletteColors(id, lookFor(id))
  })
  /** Pitch classes the player changed (built-ins only). */
  const changed = computed((): ReadonlySet<number> => {
    const { id } = current.value
    const overrides = isCustomSetId(id) ? undefined : settings.noteColourSets.overrides[id]
    return new Set(Object.keys(overrides ?? {}).map(Number))
  })

  return { builtIn, custom, current, base, changed }
}
