<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { adjustLoopRange } from '@/core/practice/adjustLoopRange'
import type { LoopRange } from '@/core/transport/LoopRange'

import AppButton from '../components/AppButton.vue'
import AppIcon from '../components/AppIcon.vue'
import AppPopover from '../components/AppPopover.vue'
import RangeSliderField from '../components/RangeSliderField.vue'
import SettingRow from '../components/SettingRow.vue'
import HudToggle from './HudToggle.vue'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * The HUD's loop row: "bars 17–32" in the secondary colour while on, the caret that opens the
 * loop popover, and the loop toggle (the last range). The popover has a
 * two-thumb bar range with from/to fields kept in sync, pre-roll beats (the same setting as the
 * Practice tab) counting back from the loop's first bar, and "Back to start" (decision 60).
 * Every change goes through adjustLoopRange, so an invalid range can't be set. While the loop is
 * on, changes apply at once; otherwise they become the range the loop button turns on.
 */
const props = defineProps<{
  readonly loop: LoopRange | null
  /** The range the loop button turns on (the last one set). */
  readonly draft: LoopRange
  readonly firstBar: number
  readonly lastBar: number
}>()
const emit = defineEmits<{
  toggle: []
  set: [range: LoopRange]
  clear: []
  toStart: []
  'update:draft': [range: LoopRange]
}>()
const open = defineModel<boolean>('open', { default: false })
const settings = useSettingsStore()

const range = ref({ start: props.draft.startBar, end: props.draft.endBar })
/** What the fields show while typing; committed on Enter or blur. */
const fromText = ref('')
const toText = ref('')
const fromInput = useTemplateRef<HTMLInputElement>('fromInput')
const toInput = useTemplateRef<HTMLInputElement>('toInput')

/**
 * Shows the range in both fields. A field that has focus gets its text selected again: Tab from
 * "From" to "To" selects the old "To", and replacing it would otherwise leave the caret at the
 * end, so the next digit typed would be appended.
 */
function syncFields(): void {
  fromText.value = String(range.value.start)
  toText.value = String(range.value.end)
  void nextTick(() => {
    const focused = [fromInput.value, toInput.value].find((el) => el === document.activeElement)
    focused?.select()
  })
}

watch(open, (isOpen) => {
  if (!isOpen) return
  const shown = props.loop ?? props.draft
  range.value = { start: shown.startBar, end: shown.endBar }
  syncFields()
})

function change(edit: { start: number } | { end: number }): void {
  range.value = adjustLoopRange(range.value, edit, props.firstBar, props.lastBar)
  syncFields()
  const next = { startBar: range.value.start, endBar: range.value.end }
  emit('update:draft', next)
  if (
    props.loop !== null &&
    (next.startBar !== props.loop.startBar || next.endBar !== props.loop.endBar)
  )
    emit('set', next)
}

function commit(end: 'start' | 'end'): void {
  const typed = Number.parseInt(end === 'start' ? fromText.value : toText.value, 10)
  // Nothing usable typed: show the current value again.
  if (Number.isNaN(typed)) syncFields()
  else change(end === 'start' ? { start: typed } : { end: typed })
}

function setLoop(): void {
  emit('set', { startBar: range.value.start, endBar: range.value.end })
}

const preRollBeats = computed(() => settings.settings.practice.preRollBeats)
/**
 * What the pre-roll leads into: the loop's first bar while a loop is on, otherwise wherever
 * play starts (decision 60).
 */
const preRollTarget = computed(() =>
  props.loop === null ? 'the play position' : `bar ${props.loop.startBar}`,
)
const preRollText = computed(() => {
  const beats = preRollBeats.value
  if (beats === 0) return 'None'
  return `${beats} ${beats === 1 ? 'beat' : 'beats'} before ${preRollTarget.value}`
})
const isCurrentLoop = computed(
  () =>
    props.loop !== null &&
    props.loop.startBar === range.value.start &&
    props.loop.endBar === range.value.end,
)
</script>

<template>
  <div class="loop-control">
    <span v-if="loop" class="value" data-testid="loop-value">{{
      loop.startBar === loop.endBar
        ? `bar ${loop.startBar}`
        : `bars ${loop.startBar}–${loop.endBar}`
    }}</span>
    <AppPopover
      v-model:open="open"
      side="left"
      align="start"
      label="Loop and pre-roll"
      data-testid="loop-popover"
    >
      <template #trigger>
        <button type="button" class="caret" aria-label="Loop options" data-testid="open-loop">
          <AppIcon name="chevronDown" :size="12" />
        </button>
      </template>
      <div class="bars">
        <div class="head">
          <span class="title">Loop bars</span>
          <output class="value" data-testid="loop-range">
            {{ range.start === range.end ? `bar ${range.start}` : `${range.start}–${range.end}` }}
          </output>
        </div>
        <RangeSliderField
          :start="range.start"
          :end="range.end"
          :min="firstBar"
          :max="lastBar"
          :labels="['Loop start bar', 'Loop end bar']"
          :value-texts="[`Bar ${range.start}`, `Bar ${range.end}`]"
          data-testid="loop-slider"
          @change="change"
        />
        <div class="fields">
          <label>
            <span>From bar</span>
            <input
              ref="fromInput"
              v-model="fromText"
              class="form-control"
              type="number"
              inputmode="numeric"
              :min="firstBar"
              :max="lastBar"
              data-testid="loop-from"
              @change="commit('start')"
              @keydown.enter.prevent="commit('start')"
            />
          </label>
          <label>
            <span>To bar</span>
            <input
              ref="toInput"
              v-model="toText"
              class="form-control"
              type="number"
              inputmode="numeric"
              :min="firstBar"
              :max="lastBar"
              data-testid="loop-to"
              @change="commit('end')"
              @keydown.enter.prevent="commit('end')"
            />
          </label>
        </div>
        <div class="actions">
          <AppButton
            variant="primary"
            size="sm"
            :disabled="isCurrentLoop"
            data-testid="loop-set"
            @click="setLoop"
          >
            {{ loop === null ? 'Loop these bars' : isCurrentLoop ? 'Looping' : 'Set loop' }}
          </AppButton>
          <AppButton
            size="sm"
            :disabled="loop === null"
            data-testid="loop-clear"
            @click="emit('clear')"
          >
            Clear
          </AppButton>
        </div>
      </div>
      <SettingRow
        setting-key="practice.preRollBeats"
        inverted
        :value-text="preRollText"
        :end-label="loop === null ? 'play position' : `bar ${loop.startBar}`"
      />
      <div class="foot">
        <AppButton
          variant="text"
          size="sm"
          icon="toStart"
          data-testid="to-start"
          @click="emit('toStart')"
        >
          Back to start
        </AppButton>
      </div>
    </AppPopover>
    <HudToggle
      icon="loop"
      tone="secondary"
      :on="loop !== null"
      :aria-label="loop ? `Loop bars ${loop.startBar}–${loop.endBar}: on` : 'Loop: off'"
      :aria-pressed="loop !== null"
      data-testid="toggle-loop"
      @click="emit('toggle')"
    />
  </div>
</template>

<style scoped>
.loop-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.value {
  color: var(--secondary);
  font-size: var(--text-sm);
  text-shadow: var(--text-shadow-hud);
}

.caret {
  display: grid;
  place-items: center;
  width: 20px;
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  filter: var(--icon-shadow-hud);
}

.caret:hover {
  color: var(--text-1);
}

.bars {
  display: grid;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--divider);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.title {
  color: var(--text-1);
  font-size: var(--text-md);
}

.value {
  color: var(--text-strong);
  font-size: var(--text-md);
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

label {
  display: grid;
  gap: var(--space-1);
  color: var(--text-3);
  font-size: var(--text-sm);
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.foot {
  display: flex;
  justify-content: flex-start;
  padding-top: var(--space-1);
  border-top: 1px solid var(--divider);
}
</style>
