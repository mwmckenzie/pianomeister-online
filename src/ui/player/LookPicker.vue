<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import type { Look } from '@/core/looks/Look'
import {
  activeLook,
  allLooks,
  applyLook,
  captureLook,
  isDefaultLook,
  isLookModified,
  nextLookName,
} from '@/core/looks/lookValues'
import { toLookFile } from '@/core/looks/toLookFile'

import AppButton from '../components/AppButton.vue'
import SelectField from '../components/SelectField.vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'

/**
 * Looks (brief decision 121): pick a built-in or saved look (applies all its values, with
 * Undo), see when the settings were changed since ("Classic · modified"), save over a saved
 * look, save the current settings as a new one, delete a saved one, or copy the current look to
 * the clipboard as a .pmlook.json file (milestone 9.1, section A).
 */
const settings = useSettingsStore()
const toasts = useToastStore()

/** The select's value when no look is picked. */
const NONE = 'none'

const active = computed(() => activeLook(settings.looks))
const modified = computed(() =>
  active.value === null ? false : isLookModified(settings.settings, active.value, settings.deviceClass),
)
const options = computed(() => [
  ...(active.value === null
    ? [{ value: NONE, label: isDefaultLook(settings.settings) ? 'Defaults' : 'Custom' }]
    : []),
  ...allLooks(settings.looks).map((look) => ({ value: look.id, label: look.name })),
])
const status = computed(() =>
  active.value !== null && modified.value ? `${active.value.name} · modified` : '',
)

const naming = ref(false)
const name = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

function pick(id: string): void {
  const look = allLooks(settings.looks).find((l) => l.id === id)
  if (look === undefined) return
  const before = settings.looks
  const { settings: next, previous } = applyLook(settings.settings, look, settings.deviceClass)
  settings.replace(next)
  settings.setLooks({ ...settings.looks, active: look.id })
  toasts.showUndo(`Look "${look.name}" applied`, () => {
    settings.restore(previous)
    settings.setLooks(before)
  })
}

/** Saves the current settings over the picked (saved) look. */
function save(): void {
  const look = active.value
  if (look === null || look.builtIn) return
  const updated = captureLook(
    settings.settings,
    look.id,
    look.name,
    new Date().toISOString(),
    look.createdAt,
  )
  settings.setLooks({
    ...settings.looks,
    saved: settings.looks.saved.map((l) => (l.id === look.id ? updated : l)),
  })
  toasts.show(`Saved "${look.name}"`)
}

async function startNaming(): Promise<void> {
  name.value = nextLookName(settings.looks)
  naming.value = true
  await nextTick()
  nameInput.value?.select()
}

function saveNew(): void {
  const trimmed = name.value.trim().slice(0, 60)
  if (trimmed === '') return
  const look: Look = captureLook(settings.settings, crypto.randomUUID(), trimmed)
  settings.setLooks({ active: look.id, saved: [...settings.looks.saved, look] })
  naming.value = false
  toasts.show(`Saved look "${trimmed}"`)
}

/**
 * The current look on the clipboard. Unchanged, it keeps the picked look's id and name; changed
 * (or none picked) it's a new look, so pasting it never clashes with the original.
 */
async function copy(): Promise<void> {
  const picked = active.value
  const same = picked !== null && !modified.value
  const name = picked === null ? 'My look' : same ? picked.name : `${picked.name} (modified)`
  const look = captureLook(settings.settings, same ? picked.id : crypto.randomUUID(), name)
  const text = JSON.stringify(toLookFile([look]), null, 2)
  try {
    await navigator.clipboard.writeText(text)
    toasts.show(`Copied look "${name}"`)
  } catch {
    toasts.show("Couldn't copy to the clipboard", 'error')
  }
}

function remove(): void {
  const look = active.value
  if (look === null || look.builtIn) return
  const before = settings.looks
  settings.setLooks({ active: null, saved: before.saved.filter((l) => l.id !== look.id) })
  toasts.showUndo(`Deleted look "${look.name}"`, () => settings.setLooks(before))
}
</script>

<template>
  <section class="look-picker" aria-label="Look" data-testid="look-picker">
    <div class="row">
      <span class="label">Look</span>
      <SelectField
        :model-value="active?.id ?? NONE"
        :options="options"
        label="Look"
        data-testid="look-select"
        @update:model-value="pick"
      />
    </div>
    <p v-if="status" class="status" data-testid="look-status">{{ status }}</p>
    <form v-if="naming" class="name-row" data-testid="look-name-form" @submit.prevent="saveNew">
      <input
        ref="nameInput"
        v-model="name"
        class="form-control"
        maxlength="60"
        aria-label="Look name"
        data-testid="look-name"
        @keydown.esc.stop.prevent="naming = false"
      />
      <AppButton size="sm" type="submit" data-testid="look-name-save">Save</AppButton>
      <AppButton size="sm" variant="text" type="button" @click="naming = false">Cancel</AppButton>
    </form>
    <div v-else class="actions">
      <AppButton
        v-if="active !== null && !active.builtIn && modified"
        size="sm"
        data-testid="look-save"
        @click="save"
      >
        Save
      </AppButton>
      <AppButton size="sm" variant="text" data-testid="look-save-new" @click="startNaming">
        {{ active !== null && modified ? 'Save as new…' : 'Save current look…' }}
      </AppButton>
      <AppButton size="sm" variant="text" data-testid="look-copy" @click="copy">
        Copy look
      </AppButton>
      <AppButton
        v-if="active !== null && !active.builtIn"
        size="sm"
        variant="text"
        data-testid="look-delete"
        @click="remove"
      >
        Delete
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
.look-picker {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--divider);
}

.row {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-3);
}

.label {
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
}

.status {
  margin: var(--space-2) 0 0;
  color: var(--text-2);
  font-size: var(--text-sm);
}

.actions,
.name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.name-row input {
  flex: 1;
  min-width: 0;
}
</style>
