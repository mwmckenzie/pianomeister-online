<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'

import type { Binding } from '@/core/commands/Binding'
import type { Command } from '@/core/commands/Command'
import type { CommandId } from '@/core/commands/CommandId'
import { bindingFromEvent, sameBinding } from '@/core/commands/keyBindings'
import { reservedReason } from '@/core/commands/reservedKeys'
import { commandById, findConflicts } from '@/core/commands/shortcutBindings'
import { MAX_KEYS } from '@/core/commands/applyShortcutEdit'

import ResetButton from '../components/ResetButton.vue'
import { keyCapture } from '../input/keyCapture'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * One command in Settings → Shortcuts (brief decisions 84–86): its key chips (click one to
 * record a new key, × removes it), "+" for a second key, and the reset icon. Recording takes
 * the next key press, modifiers included; Esc cancels and leaving the chip stops. A reserved key
 * is refused with the reason; a key another command uses asks Replace or Cancel, and nothing
 * changes until then.
 */
const props = defineProps<{ readonly command: Command }>()

const settings = useSettingsStore()
const id = computed(() => props.command.id as CommandId)
const keys = computed(() => settings.bindings.get(id.value) ?? [])
const changed = computed(() => settings.shortcuts[id.value] !== undefined)
const fixed = computed(() => props.command.fixed === true)

/** The chip being recorded (keys.length = the "+" slot), or null. */
const recording = ref<number | null>(null)
/** A refusal shown on the row for a moment. */
const message = ref('')
/** A key another command already uses, waiting for Replace or Cancel. */
const conflict = ref<{ index: number; binding: Binding; with: CommandId } | null>(null)
const row = useTemplateRef<HTMLElement>('row')
let messageTimer: ReturnType<typeof setTimeout> | undefined

async function startRecording(index: number): Promise<void> {
  conflict.value = null
  message.value = ''
  recording.value = index
  keyCapture.value = true
  await nextTick()
  row.value?.querySelector<HTMLElement>('[data-recording="true"]')?.focus()
}

function stopRecording(): void {
  recording.value = null
  keyCapture.value = false
}

/** Esc cancels: release the keys a tick later, so the dialog's own Esc handling (which runs
 *  after ours) still sees the capture and doesn't close the window. */
function cancelRecording(): void {
  recording.value = null
  setTimeout(() => (keyCapture.value = recording.value !== null), 0)
}

function showMessage(text: string): void {
  message.value = text
  clearTimeout(messageTimer)
  messageTimer = setTimeout(() => (message.value = ''), 2500)
}

function onRecordKey(event: KeyboardEvent): void {
  const index = recording.value
  if (index === null) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.metaKey) {
    cancelRecording()
    return
  }
  const binding = bindingFromEvent(event)
  // A modifier on its own: keep waiting for the key.
  if (binding === null) return
  const refused = reservedReason(binding, (b) => settings.keyLabel(b))
  if (refused !== null) {
    showMessage(refused)
    stopRecording()
    return
  }
  stopRecording()
  // Already one of this command's keys: nothing to do.
  if (keys.value.some((k, i) => i !== index && sameBinding(k, binding))) return
  const others = findConflicts(settings.bindings, binding, props.command.scope, id.value)
  const taken = others[0]
  if (taken !== undefined) {
    conflict.value = { index, binding, with: taken }
    return
  }
  settings.editShortcuts({ type: 'set', id: id.value, index, binding })
}

function replace(): void {
  const c = conflict.value
  if (c === null) return
  settings.editShortcuts({
    type: 'replace',
    id: id.value,
    index: c.index,
    binding: c.binding,
    from: c.with,
  })
  conflict.value = null
}

function remove(index: number): void {
  conflict.value = null
  settings.editShortcuts({ type: 'remove', id: id.value, index })
}

function reset(): void {
  conflict.value = null
  settings.editShortcuts({ type: 'reset', id: id.value })
}

onBeforeUnmount(() => {
  clearTimeout(messageTimer)
  if (recording.value !== null) keyCapture.value = false
})

const conflictLabel = computed(() =>
  conflict.value === null ? '' : commandById(conflict.value.with).label,
)
</script>

<template>
  <div
    ref="row"
    class="shortcut-row"
    :data-testid="`shortcut-${command.id}`"
    :data-changed="changed"
  >
    <span class="label">{{ command.label }}</span>
    <span class="side">
      <span class="chips">
        <template v-for="(key, index) in keys" :key="index">
          <button
            v-if="recording === index"
            type="button"
            class="chip recording"
            data-recording="true"
            data-testid="shortcut-recording"
            @keydown="onRecordKey"
            @blur="stopRecording"
          >
            Press a key… <span class="hint">Esc to cancel</span>
          </button>
          <span v-else class="chip-group">
            <button
              type="button"
              class="chip"
              :disabled="fixed"
              :aria-label="`${command.label}: ${settings.keyLabel(key)}. Change`"
              data-testid="shortcut-key"
              @click="startRecording(index)"
            >
              {{ settings.keyLabel(key) }}
            </button>
            <button
              v-if="!fixed"
              type="button"
              class="remove"
              :aria-label="`Remove ${settings.keyLabel(key)} from ${command.label}`"
              data-testid="shortcut-remove"
              @click="remove(index)"
            >
              ×
            </button>
          </span>
        </template>
        <span
          v-if="keys.length === 0 && recording === null"
          class="none"
          data-testid="shortcut-none"
          >—</span
        >
        <button
          v-if="recording !== null && recording === keys.length"
          type="button"
          class="chip recording"
          data-recording="true"
          data-testid="shortcut-recording"
          @keydown="onRecordKey"
          @blur="stopRecording"
        >
          Press a key… <span class="hint">Esc to cancel</span>
        </button>
        <button
          v-else-if="!fixed && keys.length < MAX_KEYS"
          type="button"
          class="add"
          :aria-label="`Add a key for ${command.label}`"
          data-testid="shortcut-add"
          @click="startRecording(keys.length)"
        >
          +
        </button>
      </span>
      <ResetButton
        v-if="!fixed"
        :changed="changed"
        :setting-label="command.label"
        data-testid="shortcut-reset"
        @reset="reset"
      />
      <span v-else class="fixed" title="Esc always closes">Fixed</span>
    </span>
    <p v-if="message" class="message" role="status" data-testid="shortcut-message">
      {{ message }}
    </p>
    <p v-if="conflict" class="conflict" role="alert" data-testid="shortcut-conflict">
      Already used by {{ conflictLabel }}
      <button type="button" class="link" data-testid="shortcut-replace" @click="replace">
        Replace
      </button>
      <button type="button" class="link" data-testid="shortcut-cancel" @click="conflict = null">
        Cancel
      </button>
    </p>
  </div>
</template>

<style scoped>
/* Never wider than the tab: the label takes what's left and wraps; the chips and reset icon
   never shrink, and move under the label (right-aligned) when they don't fit beside it. */
.shortcut-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--space-3);
  min-height: 44px;
  padding: 4px 0;
  border-bottom: 1px solid var(--divider);
}

.label {
  flex: 1 1 12ch;
  min-width: 0;
  color: var(--text-1);
  font-size: var(--text-md);
  overflow-wrap: anywhere;
}

.side {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-3);
  margin-left: auto;
}

.chips {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  white-space: nowrap;
}

.chip-group {
  position: relative;
  display: inline-flex;
}

.chip {
  flex-shrink: 0;
  min-width: 36px;
  white-space: nowrap;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--field);
  color: var(--text-1);
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
}

.chip:hover:not(:disabled) {
  border-color: rgb(var(--primary-rgb) / 60%);
}

.chip:disabled {
  color: var(--text-3);
  cursor: default;
}

.chip.recording {
  border-color: var(--primary);
  background: rgb(var(--primary-rgb) / 14%);
  color: var(--text-strong);
}

.hint {
  margin-left: 6px;
  color: var(--text-3);
  font-size: var(--text-xs);
}

/* × shows on hover or focus, at the chip's corner. */
.remove {
  position: absolute;
  top: -7px;
  right: -7px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--bg-raised);
  box-shadow: 0 0 0 1px var(--border-strong);
  color: var(--text-2);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur-fast);
}

.chip-group:hover .remove,
.chip-group:focus-within .remove {
  opacity: 1;
}

.add {
  width: 30px;
  height: 30px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  font-size: var(--text-md);
  cursor: pointer;
}

.add:hover {
  color: var(--text-1);
}

.none {
  min-width: 36px;
  color: var(--text-4);
  text-align: center;
}

.fixed {
  color: var(--text-4);
  font-size: var(--text-xs);
}

.message,
.conflict {
  flex-basis: 100%;
  margin: 0 0 4px;
  font-size: var(--text-sm);
  text-align: right;
}

.message {
  color: var(--text-3);
}

.conflict {
  color: var(--warning);
}

.link {
  margin-left: var(--space-2);
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
</style>
