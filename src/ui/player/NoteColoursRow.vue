<script setup lang="ts">
import { computed, useId } from 'vue'

import { BUILT_IN_COLOUR_SETS } from '@/core/color/BUILT_IN_COLOUR_SETS'
import { isSetModified } from '@/core/color/colourSetEdits'
import { isCustomSetId } from '@/core/color/isNoteColourSetId'
import type { NoteColourSetId } from '@/core/settings/NoteColourSetId'

import AppButton from '../components/AppButton.vue'
import ResetButton from '../components/ResetButton.vue'
import SelectField from '../components/SelectField.vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStateStore } from '../stores/uiStateStore'

/**
 * The look's Note colours (milestone 10.6): the built-in sets, the player's own, and the set on
 * screen when only the look's copy of it is left. Colours are edited in Settings → Appearance.
 */
const settings = useSettingsStore()
const ui = useUiStateStore()
const id = useId()

interface Option {
  readonly value: NoteColourSetId
  readonly label: string
  readonly group: string
}

const palette = computed(() => settings.settings.notes.palette)
const saved = computed(() => settings.settings.notes.paletteSaved)
/** A custom set that isn't on this device (deleted, or a look from elsewhere). */
const missing = computed(
  () =>
    isCustomSetId(palette.value) &&
    !settings.noteColourSets.custom.some((set) => set.id === palette.value),
)

const options = computed((): Option[] => {
  const sets = settings.noteColourSets
  return [
    ...BUILT_IN_COLOUR_SETS.map((set) => ({
      value: set.id,
      label: isSetModified(sets, set.id) ? `${set.name} · modified` : set.name,
      group: 'Built-in',
    })),
    ...sets.custom.map((set) => ({ value: set.id, label: set.name, group: 'Your sets' })),
    ...(missing.value
      ? [
          {
            value: palette.value,
            label: saved.value === null ? 'Missing set' : `${saved.value.name} (saved in look)`,
            group: 'Saved in look',
          },
        ]
      : []),
  ]
})

function edit(): void {
  ui.colourSetRequest = palette.value
  ui.settingsTabRequest = 'appearance'
}
</script>

<template>
  <div
    class="row"
    data-testid="setting-notes-palette"
    :data-changed="!settings.isDefault('notes.palette')"
  >
    <label class="label" :for="id">Note colours</label>
    <span class="end">
      <SelectField
        :id="id"
        :model-value="palette"
        :options="options"
        label="Note colours"
        data-testid="setting-notes-palette-control"
        @update:model-value="settings.chooseColourSet"
      />
      <ResetButton
        :changed="!settings.isDefault('notes.palette')"
        setting-label="Note colours"
        data-testid="setting-notes-palette-reset"
        @reset="settings.chooseColourSet('default')"
      />
    </span>
    <span class="actions">
      <AppButton
        v-if="missing && saved !== null"
        variant="text"
        size="sm"
        data-testid="save-colour-set"
        @click="settings.saveMissingSet"
      >
        Save as a set
      </AppButton>
      <AppButton v-if="!missing" variant="text" size="sm" data-testid="edit-colours" @click="edit">
        Edit colours…
      </AppButton>
    </span>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: var(--space-2) 0;
}

.label {
  flex: 1 0 auto;
  color: var(--text-1);
  font-size: var(--text-md);
  white-space: nowrap;
}

.end {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
  margin-left: auto;
}

.actions {
  display: flex;
  flex-basis: 100%;
  justify-content: flex-end;
}
</style>
