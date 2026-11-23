<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import type { Look } from '@/core/looks/Look'
import { lookFileName } from '@/core/looks/lookFileName'
import { BUILT_IN_LOOKS } from '@/core/looks/BUILT_IN_LOOKS'
import { captureLook, isDefaultLook, nextLookName } from '@/core/looks/lookValues'
import { toLookFile } from '@/core/looks/toLookFile'

import AppButton from '../components/AppButton.vue'
import AppPopover from '../components/AppPopover.vue'
import IconButton from '../components/IconButton.vue'
import SelectField from '../components/SelectField.vue'
import { useListeningStore } from '../stores/listeningStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { useLooks } from './useLooks'

/**
 * Looks (brief decision 121): pick a built-in or saved look — every playfield setting, never
 * device cost — with Undo; see when the settings changed since ("Classic · modified"); save,
 * save as new, rename, delete; copy, paste, export and import `.pmlook.json` files. Built-ins
 * can't be changed, only saved as new.
 */
const settings = useSettingsStore()
const toasts = useToastStore()
const listening = useListeningStore()

/**
 * While listening, the playlist's saved look the song shows (milestone 9.5 C): "Update playlist
 * look" saves the sidebar's changes over it, so they outlast leaving listening.
 */
const playlistLook = computed(() =>
  listening.active && listening.playlistLook !== null
    ? (settings.looks.saved.find((l) => l.id === listening.playlistLook) ?? null)
    : null,
)

function updatePlaylistLook(): void {
  const look = playlistLook.value
  if (look === null) return
  const before = settings.looks
  const updated = captureLook(settings.settings, look.id, look.name, now(), look.createdAt)
  settings.setLooks({
    ...before,
    saved: before.saved.map((l) => (l.id === look.id ? updated : l)),
  })
  toasts.showUndo(`Updated playlist look "${look.name}"`, () => settings.setLooks(before))
}
const { active, modified, apply, importText, importFile, exportLooks } = useLooks()

/** The select's value when no look is picked. */
const NONE = 'none'
const MAX_NAME = 60

const options = computed(() => [
  ...(active.value === null
    ? [
        {
          value: NONE,
          label: isDefaultLook(settings.settings, settings.deviceClass) ? 'Defaults' : 'Custom',
        },
      ]
    : []),
  ...BUILT_IN_LOOKS.map((look) => ({ value: look.id, label: look.name })),
  ...settings.looks.saved.map((look) => ({ value: look.id, label: look.name, group: 'My looks' })),
])
const status = computed(() =>
  active.value !== null && modified.value ? `${active.value.name} · modified` : '',
)
const saved = computed(() => (active.value !== null && !active.value.builtIn ? active.value : null))

/** The name form: a new look, or renaming the picked saved one. */
const naming = ref<'new' | 'rename' | null>(null)
const name = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const now = () => new Date().toISOString()

/** Saves the current settings over the picked (saved) look. */
function save(): void {
  const look = saved.value
  if (look === null) return
  const updated = captureLook(settings.settings, look.id, look.name, now(), look.createdAt)
  settings.setLooks({
    ...settings.looks,
    saved: settings.looks.saved.map((l) => (l.id === look.id ? updated : l)),
  })
  toasts.show(`Saved "${look.name}"`)
}

async function startNaming(mode: 'new' | 'rename'): Promise<void> {
  menuOpen.value = false
  name.value = mode === 'rename' ? (saved.value?.name ?? '') : nextLookName(settings.looks)
  naming.value = mode
  await nextTick()
  nameInput.value?.select()
}

/** True when another look (built-in or saved) already has this name. */
function nameTaken(candidate: string, except: string | null): boolean {
  const lower = candidate.toLowerCase()
  return [...BUILT_IN_LOOKS, ...settings.looks.saved].some(
    (look) => look.id !== except && look.name.toLowerCase() === lower,
  )
}

function submitName(): void {
  const trimmed = name.value.trim().slice(0, MAX_NAME)
  if (trimmed === '') return
  const renaming = naming.value === 'rename' ? saved.value : null
  if (nameTaken(trimmed, renaming?.id ?? null)) {
    toasts.show(`There's already a look called "${trimmed}"`, 'error')
    return
  }
  if (renaming !== null) {
    const renamed: Look = { ...renaming, name: trimmed, updatedAt: now() }
    const before = settings.looks
    settings.setLooks({
      ...before,
      saved: before.saved.map((l) => (l.id === renaming.id ? renamed : l)),
    })
    toasts.showUndo(`Renamed to "${trimmed}"`, () => settings.setLooks(before))
  } else {
    const look = captureLook(settings.settings, crypto.randomUUID(), trimmed)
    settings.setLooks({ active: look.id, saved: [...settings.looks.saved, look] })
    toasts.show(`Saved look "${trimmed}"`)
  }
  naming.value = null
}

/**
 * What's on screen as a look: unchanged, the picked look itself (its id and name); changed (or
 * none picked) a new look "⟨Name⟩ (modified)", so importing it never clashes with the original.
 */
function currentLook(): Look {
  const picked = active.value
  if (picked !== null && !modified.value) return picked
  const label = picked === null ? 'My look' : `${picked.name} (modified)`
  return captureLook(settings.settings, crypto.randomUUID(), label)
}

async function copy(): Promise<void> {
  const look = currentLook()
  try {
    await navigator.clipboard.writeText(JSON.stringify(toLookFile([look]), null, 2))
    toasts.show(`Copied look "${look.name}"`)
  } catch {
    toasts.show("Couldn't copy to the clipboard", 'error')
  }
}

async function paste(): Promise<void> {
  menuOpen.value = false
  let text: string
  try {
    text = await navigator.clipboard.readText()
  } catch {
    toasts.show("Couldn't read the clipboard", 'error')
    return
  }
  if (text.trim() === '') toasts.show('The clipboard has no look', 'error')
  else importText(text)
}

/** Export look: the picked look as saved (a built-in too). */
function exportPicked(): void {
  menuOpen.value = false
  if (active.value !== null) exportLooks([active.value], lookFileName(active.value.name))
}

/** Export current settings: what's on screen, as "⟨Name⟩ (modified)" with a new id. */
function exportCurrent(): void {
  menuOpen.value = false
  const look = currentLook()
  exportLooks([look], lookFileName(look.name))
}

function exportAll(): void {
  menuOpen.value = false
  exportLooks(settings.looks.saved, 'pianomeister-looks.pmlook.json')
}

function chooseFile(): void {
  menuOpen.value = false
  fileInput.value?.click()
}

async function onFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  for (const file of input.files ?? []) await importFile(file)
  input.value = ''
}

function remove(): void {
  menuOpen.value = false
  const look = saved.value
  if (look === null) return
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
        @update:model-value="apply"
      />
      <AppPopover
        v-model:open="menuOpen"
        side="bottom"
        align="end"
        label="Look actions"
        class="look-menu-popover"
      >
        <template #trigger>
          <IconButton icon="more" label="More look actions" size="sm" data-testid="look-menu" />
        </template>
        <ul class="menu" role="list">
          <li v-if="saved !== null">
            <button
              type="button"
              class="item"
              data-testid="look-rename"
              @click="startNaming('rename')"
            >
              Rename…
            </button>
          </li>
          <li v-if="active !== null">
            <button type="button" class="item" data-testid="look-export" @click="exportPicked">
              Export look
            </button>
          </li>
          <li v-if="modified || active === null">
            <button
              type="button"
              class="item"
              data-testid="look-export-current"
              @click="exportCurrent"
            >
              Export current settings
            </button>
          </li>
          <li v-if="settings.looks.saved.length > 0">
            <button type="button" class="item" data-testid="look-export-all" @click="exportAll">
              Export all my looks
            </button>
          </li>
          <li class="divider" role="separator" />
          <li>
            <button type="button" class="item" data-testid="look-import" @click="chooseFile">
              Import…
            </button>
          </li>
          <li>
            <button type="button" class="item" data-testid="look-paste" @click="paste">
              Paste look
            </button>
          </li>
          <template v-if="saved !== null">
            <li class="divider" role="separator" />
            <li>
              <button type="button" class="item danger" data-testid="look-delete" @click="remove">
                Delete
              </button>
            </li>
          </template>
        </ul>
      </AppPopover>
    </div>
    <input
      ref="fileInput"
      type="file"
      accept=".pmlook.json,.json,application/json"
      multiple
      hidden
      data-testid="look-file"
      @change="onFiles"
    />
    <p v-if="status" class="status" data-testid="look-status">{{ status }}</p>
    <form
      v-if="naming !== null"
      class="name-row"
      data-testid="look-name-form"
      @submit.prevent="submitName"
    >
      <input
        ref="nameInput"
        v-model="name"
        class="form-control"
        :maxlength="MAX_NAME"
        :aria-label="naming === 'rename' ? 'New look name' : 'Look name'"
        data-testid="look-name"
        @keydown.esc.stop.prevent="naming = null"
      />
      <AppButton size="sm" type="submit" data-testid="look-name-save">
        {{ naming === 'rename' ? 'Rename' : 'Save' }}
      </AppButton>
      <AppButton size="sm" variant="text" type="button" @click="naming = null">Cancel</AppButton>
    </form>
    <div v-else class="actions">
      <AppButton v-if="saved !== null && modified" size="sm" data-testid="look-save" @click="save">
        Save
      </AppButton>
      <AppButton
        v-if="playlistLook !== null"
        size="sm"
        data-testid="look-update-playlist"
        @click="updatePlaylistLook"
      >
        Update playlist look
      </AppButton>
      <AppButton size="sm" variant="text" data-testid="look-save-new" @click="startNaming('new')">
        {{ active !== null && modified ? 'Save as new…' : 'Save current look…' }}
      </AppButton>
      <AppButton size="sm" variant="text" data-testid="look-copy" @click="copy">
        Copy look
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
  grid-template-columns: auto 1fr auto;
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

.menu {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  width: 100%;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--text-1);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.item:hover,
.item:focus-visible {
  background: var(--selection);
  outline: none;
}

.item.danger {
  color: var(--danger);
}

.divider {
  height: 1px;
  margin: var(--space-1) 0;
  background: var(--divider);
}
</style>

<style>
/* The menu is portalled out of the picker, so it's styled globally. */
.popover.look-menu-popover {
  width: 220px;
  padding: var(--space-2);
}
</style>
