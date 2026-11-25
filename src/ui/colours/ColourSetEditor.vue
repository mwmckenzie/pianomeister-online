<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

import { closeNeighboursText } from '@/core/color/closeNeighbours'
import { addSet, renameSet, resetColour, resetSet, setColour } from '@/core/color/colourSetEdits'
import { copySetName, isSetNameTaken, MAX_SET_NAME } from '@/core/color/freeSetName'
import { isCustomSetId } from '@/core/color/isNoteColourSetId'
import { NOTE_LABELS } from '@/core/color/NOTE_LABELS'
import type { CustomSetId } from '@/core/settings/CustomSetId'
import type { NoteColourSetId } from '@/core/settings/NoteColourSetId'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import ColorField from '../components/ColorField.vue'
import { useElementSize } from '../overview/useElementSize'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import ColourPreview from './ColourPreview.vue'
import ColourSetList from './ColourSetList.vue'
import OctaveKeys from './OctaveKeys.vue'
import { useColourSets } from './useColourSets'

/**
 * The note colour set editor (milestone 10.6): pick a set, change its colours (at once, with a
 * reset for each), or make sets of one's own. Selecting a set here only edits it; the look
 * decides which one the playfield uses.
 */
const emit = defineEmits<{ back: [] }>()
const selected = defineModel<NoteColourSetId>({ required: true })

const settings = useSettingsStore()
const toasts = useToastStore()
const { builtIn, custom, current, base, changed } = useColourSets(selected)

const box = useTemplateRef<HTMLElement>('box')
const size = useElementSize(box)
const wide = computed(() => size.value.width >= 900)
const compact = computed(() => size.value.width < 620)

const isCustom = computed(() => isCustomSetId(current.value.id))
const key = ref(0)
const colour = computed(() => current.value.colours[key.value] as string)
const original = computed(() => base.value[key.value] as string)
const keyChanged = computed(() => changed.value.has(key.value))
const fromLook = computed(() => current.value.id === 'mono' || current.value.id === 'twoTone')

const count = computed(() => {
  if (isCustom.value) return ''
  const n = changed.value.size
  if (n === 0) return 'Original colours'
  return `${n} ${n === 1 ? 'colour' : 'colours'} changed from the original`
})
// The shipped sets are as they are: advice only for what the player made.
const warning = computed(() =>
  isCustom.value || current.value.modified ? closeNeighboursText(current.value.colours) : null,
)
const nameLabel = computed(() => {
  if (isCustom.value) return 'Name'
  return compact.value
    ? 'Built-in set: edit or duplicate it'
    : 'Built-in set (edit colours here, or duplicate to make your own)'
})
const footer = computed(() => {
  if (isCustom.value) return 'Changes save as you go.'
  return current.value.modified
    ? 'Changes apply now. Save as a new set to keep the original too.'
    : 'Changes apply now and can be reset per colour.'
})

function change(hex: string): void {
  settings.setColourSets(
    setColour(settings.noteColourSets, current.value.id, key.value, hex, original.value),
  )
}

function resetOne(): void {
  const { id } = current.value
  if (!isCustomSetId(id))
    settings.setColourSets(resetColour(settings.noteColourSets, id, key.value))
}

/** Every colour of the set back, with Undo like the other resets (decision 51). */
function resetAll(): void {
  const { id, name } = current.value
  if (isCustomSetId(id)) return
  const before = settings.noteColourSets.overrides[id]
  settings.setColourSets(resetSet(settings.noteColourSets, id))
  toasts.showUndo(`${name} colours reset`, () => {
    const sets = settings.noteColourSets
    settings.setColourSets({ ...sets, overrides: { ...sets.overrides, [id]: before } })
  })
}

// ── Names ────────────────────────────────────────────────────────────────────────────────────
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
const draft = ref(current.value.name)
watch(
  () => [current.value.id, current.value.name] as const,
  ([, name]) => (draft.value = name),
)

function commitName(): void {
  const { id } = current.value
  const set = settings.noteColourSets.custom.find((s) => s.id === id)
  if (set === undefined) return
  const name = draft.value.trim().slice(0, MAX_SET_NAME)
  if (name === '' || name === set.name) {
    draft.value = set.name
  } else if (isSetNameTaken(settings.noteColourSets, name, id)) {
    toasts.show(`There's already a set called "${name}"`, 'error')
    draft.value = set.name
  } else {
    settings.setColourSets(renameSet(settings.noteColourSets, set.id, name))
  }
}
// Closing the window removes the field before it blurs.
onBeforeUnmount(commitName)

// ── New sets ─────────────────────────────────────────────────────────────────────────────────
function create(name: string): void {
  const id: CustomSetId = `custom-${crypto.randomUUID()}`
  const { colours } = current.value
  settings.setColourSets(addSet(settings.noteColourSets, { id, name, colours }))
  selected.value = id
}

async function duplicate(): Promise<void> {
  create(copySetName(settings.noteColourSets, current.value.name))
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

const naming = ref(false)
const newName = ref('')
function startSaveAs(): void {
  newName.value = copySetName(settings.noteColourSets, current.value.name)
  naming.value = true
}
function saveAs(): void {
  const name = newName.value.trim().slice(0, MAX_SET_NAME)
  if (name === '') return
  if (isSetNameTaken(settings.noteColourSets, name)) {
    toasts.show(`There's already a set called "${name}"`, 'error')
    return
  }
  naming.value = false
  create(name)
}

const deleting = ref(false)
function remove(): void {
  const { id } = current.value
  deleting.value = false
  if (!isCustomSetId(id)) return
  selected.value = 'default'
  settings.deleteColourSet(id)
}
</script>

<template>
  <div ref="box" class="editor" :class="{ wide, compact }" data-testid="colour-editor">
    <AppButton
      class="back"
      variant="text"
      size="sm"
      icon="chevronLeft"
      data-testid="colour-editor-back"
      @click="emit('back')"
    >
      Appearance
    </AppButton>

    <ColourSetList
      v-model="selected"
      class="sets"
      :built-in="builtIn"
      :custom="custom"
      :compact="compact"
      @create="duplicate"
    />

    <div class="main">
      <div class="name-row">
        <label class="name-label">
          {{ nameLabel }}
          <input
            ref="nameInput"
            v-model="draft"
            class="form-control name"
            type="text"
            :maxlength="MAX_SET_NAME"
            :readonly="!isCustom"
            data-testid="colour-set-name"
            @keydown.enter="commitName"
            @blur="commitName"
          />
        </label>
        <AppButton size="sm" data-testid="duplicate-colour-set" @click="duplicate">
          Duplicate
        </AppButton>
        <AppButton
          v-if="isCustom"
          size="sm"
          danger
          data-testid="delete-colour-set"
          @click="deleting = true"
        >
          Delete
        </AppButton>
        <AppButton
          v-if="current.modified"
          size="sm"
          data-testid="reset-colour-set"
          @click="resetAll"
        >
          Reset all colours
        </AppButton>
      </div>

      <section class="keys" aria-label="Colours per note">
        <div class="hint">
          <span>Click a key to change its colour</span>
          <span data-testid="colour-count">{{ count }}</span>
        </div>
        <OctaveKeys v-model="key" :colours="current.colours" :changed="changed" />
        <p v-if="fromLook" class="note">Unchanged notes take the look's colour.</p>
      </section>

      <div class="editing">
        <section class="selected" aria-label="Selected colour">
          <span class="swatch" :style="{ background: colour }" />
          <div class="selected-name">
            <span class="note-name">{{ NOTE_LABELS[key] }}</span>
            <span v-if="keyChanged" class="was" data-testid="colour-was">
              modified · was {{ original.toLowerCase() }}
            </span>
          </div>
          <ColorField
            :key="`${current.id}-${key}`"
            :model-value="colour"
            :label="`${NOTE_LABELS[key]} note`"
            data-testid="colour-field"
            @update:model-value="change"
          />
          <AppButton
            v-if="!isCustom"
            size="sm"
            :disabled="!keyChanged"
            data-testid="reset-colour"
            @click="resetOne"
          >
            Reset this colour
          </AppButton>
        </section>
        <ColourPreview v-if="!wide" class="strip" compact :colours="current.colours" />
      </div>

      <p v-if="warning !== null" class="warning" role="status" data-testid="colour-warning">
        {{ warning }}
      </p>

      <div class="bottom">
        <AppButton
          v-if="current.modified"
          variant="primary"
          data-testid="save-as-colour-set"
          @click="startSaveAs"
        >
          Save as new set…
        </AppButton>
        <span class="footer-text">{{ footer }}</span>
      </div>
    </div>

    <aside class="preview" :aria-label="wide ? 'Preview' : 'About this set'">
      <template v-if="wide">
        <h4 class="section-caps preview-title">Preview</h4>
        <ColourPreview class="canvas" :colours="current.colours" />
      </template>
      <p class="note" data-testid="colour-preview-text">
        <template v-if="isCustom">
          A look that uses this set stores its colours, so the look still works on another device or
          after you delete the set.
        </template>
        <template v-else>
          Looks that use this set show your changes on this device. To take them along, save as a
          new set.
        </template>
      </p>
    </aside>

    <AppDialog
      v-model:open="deleting"
      :title="`Delete ${current.name}?`"
      show-title
      width="460px"
      data-testid="delete-colour-set-dialog"
    >
      <p class="dialog-text">Looks that use it keep their colours.</p>
      <template #footer>
        <AppButton @click="deleting = false">Cancel</AppButton>
        <AppButton variant="primary" danger data-testid="delete-colour-set-confirm" @click="remove">
          Delete
        </AppButton>
      </template>
    </AppDialog>

    <AppDialog
      v-model:open="naming"
      title="Save as new set"
      show-title
      width="460px"
      data-testid="save-as-dialog"
    >
      <form id="save-as-form" @submit.prevent="saveAs">
        <input
          v-model="newName"
          class="form-control name"
          type="text"
          :maxlength="MAX_SET_NAME"
          aria-label="Name of the new set"
          data-testid="save-as-name"
        />
      </form>
      <template #footer>
        <AppButton @click="naming = false">Cancel</AppButton>
        <AppButton
          variant="primary"
          :disabled="newName.trim() === ''"
          data-testid="save-as-confirm"
          @click="saveAs"
        >
          Save
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.editor {
  display: grid;
  grid-template: auto auto auto / 200px minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3) var(--space-6);
  min-height: 100%;
}

.editor.wide {
  grid-template: auto minmax(0, 1fr) / 200px minmax(0, 1fr) 240px;
  align-items: stretch;
}

.editor.compact {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: stretch;
}

.back {
  grid-column: 1 / -1;
  justify-self: start;
  align-self: flex-start;
}

.editor:not(.wide) .sets {
  grid-row: span 2;
}

.main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-2);
}

.name-label {
  display: flex;
  flex: 1 1 220px;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  color: var(--text-4);
  font-size: var(--text-xs);
}

.name {
  width: 100%;
  font-size: var(--text-lg);
}

.name[readonly] {
  border-color: var(--divider-soft);
  background: transparent;
}

.keys {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.hint {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  max-width: 588px;
  color: var(--text-3);
  font-size: var(--text-sm);
}

.note {
  margin: 0;
  color: var(--text-3);
  font-size: var(--text-xs);
  line-height: 1.45;
}

.editing {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 588px;
}

.editor:not(.wide) .main {
  gap: var(--space-3);
}

.editor.compact .main {
  gap: var(--space-2);
}

/* The colour being edited and its preview stay in view while the rest scrolls; where the window
   is too short for that, they scroll along. */
@media (min-height: 640px) {
  .editor:not(.wide) .editing {
    position: sticky;
    z-index: 1;
    top: 0;
    bottom: 0;
    border-radius: 14px;
    background: var(--bg-raised);
  }
}

.selected {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--field);
}

.swatch {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

.selected-name {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 70px;
}

.note-name {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
}

.was {
  color: var(--warning);
  font-size: var(--text-xs);
}

.warning {
  max-width: 588px;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid rgb(var(--warning-rgb) / 28%);
  border-radius: 12px;
  background: rgb(var(--warning-rgb) / 10%);
  color: var(--warning);
  font-size: var(--text-sm);
  line-height: 1.45;
}

.bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-top: auto;
}

.footer-text {
  color: var(--text-4);
  font-size: var(--text-xs);
}

.preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.preview-title {
  margin: 0;
}

.canvas {
  flex: 1;
}

.strip {
  flex: none;
  height: 120px;
}
</style>
