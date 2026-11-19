<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'

import { adjustLoopRange } from '@/core/practice/adjustLoopRange'
import type { LoopRange } from '@/core/transport/LoopRange'

import AppButton from '../components/AppButton.vue'
import AppIcon from '../components/AppIcon.vue'
import AppPopover from '../components/AppPopover.vue'
import RangeSliderField from '../components/RangeSliderField.vue'
import type { SettingOverride } from '../components/SettingOverride'
import SettingRow from '../components/SettingRow.vue'
import { usePracticeStore } from '../stores/practiceStore'
import HudToggle from './HudToggle.vue'

/**
 * The HUD's loop row: "bars 17–32" in the secondary colour while on, the caret that opens the
 * loop popover, and the loop toggle (the last range). The popover has a
 * two-thumb bar range with from/to fields kept in sync, pre-roll beats (the same setting as the
 * Practice tab) counting back from the loop's first bar, and "Back to start" (decision 60).
 * Every change goes through adjustLoopRange, so an invalid range can't be set. While the loop is
 * on, a committed change (slider let go, a From/To field committed) applies, and the playhead
 * jumps to the new start (brief decision 8); dragging only moves the thumbs. With the loop off,
 * changes become the range the loop button turns on.
 *
 * The −/+ beside each field nudge that end by a bar, like the loop nudge commands (decision 92):
 * the range shows at once and applies once nudging pauses. They're for the pointer and left out
 * of the Tab order, so Tab still goes From → To (the keyboard has the fields and the commands).
 *
 * With a bookmark loaded these changes are temporary (brief decision 69). While the setup differs
 * from the last loaded entry, "Back to ⟨name⟩" returns to it (the bookmark, or Full song: loop
 * off, 100%). "Save as bookmark" saves what's playing in one click.
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
  saveBookmark: []
  revert: []
  nudge: [edge: 'start' | 'end', bars: number]
}>()
const open = defineModel<boolean>('open', { default: false })
const practice = usePracticeStore()
const uid = useId()

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

// A revert (or another load) moves the loop: show it.
watch(
  () => props.loop,
  (loop) => {
    if (loop === null || !open.value) return
    range.value = { start: loop.startBar, end: loop.endBar }
    syncFields()
  },
)

/** Moves the shown range (and the loop button's range); the loop itself waits for a commit. */
function change(edit: { start: number } | { end: number }): void {
  range.value = adjustLoopRange(range.value, edit, props.firstBar, props.lastBar)
  syncFields()
  emit('update:draft', { startBar: range.value.start, endBar: range.value.end })
}

/** Applies the shown range to a loop that's on (the playhead then jumps to its start). */
function commitRange(): void {
  const next = { startBar: range.value.start, endBar: range.value.end }
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
  else {
    change(end === 'start' ? { start: typed } : { end: typed })
    commitRange()
  }
}

function setLoop(): void {
  emit('set', { startBar: range.value.start, endBar: range.value.end })
}

const preRollBeats = computed(() => practice.current.preRollBeats)
/** What "Back to" returns to: the last loaded bookmark, or Full song. */
const backName = computed(() => practice.bookmark?.name ?? 'Full song')

/** With a bookmark loaded, pre-roll edits are temporary and reset to the bookmark's value. */
const preRollOverride = computed((): SettingOverride | undefined =>
  practice.bookmark === null
    ? undefined
    : {
        value: practice.current.preRollBeats,
        changed: practice.isTemporary('preRollBeats'),
        set: (value) => practice.setPreRollBeats(value as number),
        reset: () => practice.revertField('preRollBeats'),
      },
)

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
          @commit="commitRange"
        />
        <div class="fields">
          <div class="field">
            <label :for="`${uid}-start`">From bar</label>
            <div class="field-row">
              <input
                :id="`${uid}-start`"
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
              <button
                type="button"
                class="nudge"
                tabindex="-1"
                aria-label="Loop start one bar earlier"
                data-testid="loop-from-down"
                @click="emit('nudge', 'start', -1)"
              >
                −
              </button>
              <button
                type="button"
                class="nudge"
                tabindex="-1"
                aria-label="Loop start one bar later"
                data-testid="loop-from-up"
                @click="emit('nudge', 'start', 1)"
              >
                +
              </button>
            </div>
          </div>
          <div class="field">
            <label :for="`${uid}-end`">To bar</label>
            <div class="field-row">
              <input
                :id="`${uid}-end`"
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
              <button
                type="button"
                class="nudge"
                tabindex="-1"
                aria-label="Loop end one bar earlier"
                data-testid="loop-to-down"
                @click="emit('nudge', 'end', -1)"
              >
                −
              </button>
              <button
                type="button"
                class="nudge"
                tabindex="-1"
                aria-label="Loop end one bar later"
                data-testid="loop-to-up"
                @click="emit('nudge', 'end', 1)"
              >
                +
              </button>
            </div>
          </div>
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
        :override="preRollOverride"
      />
      <!-- "Back to" and the name on its own dim line: auto names are long (up to two lines,
           then an ellipsis; the full name in the tooltip). -->
      <button
        v-if="practice.changed.length > 0"
        type="button"
        class="back"
        :title="`Back to ${backName}`"
        data-testid="back-to-loaded"
        @click="emit('revert')"
      >
        <AppIcon name="reset" :size="16" class="back-icon" />
        <span class="back-text">
          <span>Back to</span>
          <span class="back-name" data-testid="back-to-name">{{ backName }}</span>
        </span>
      </button>
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
        <AppButton
          variant="text"
          size="sm"
          icon="bookmarkAdd"
          data-testid="save-bookmark"
          @click="emit('saveBookmark')"
        >
          Save as bookmark
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-3);
}

.field {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.field label {
  color: var(--text-3);
  font-size: var(--text-sm);
}

.field-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px 28px;
  gap: 4px;
}

.field-row .form-control {
  width: 100%;
  min-width: 0;
}

.nudge {
  padding: 0;
  border: 1px solid var(--border-field);
  border-radius: 8px;
  background: var(--field);
  color: var(--text-2);
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
}

.nudge:hover {
  color: var(--text-1);
}

.nudge:focus-visible {
  box-shadow: var(--focus-ring-field);
  outline: none;
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

.back {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
  margin-top: var(--space-2);
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.back:hover {
  background: var(--field);
}

.back:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-field);
}

.back-icon {
  margin-top: 1px;
  color: var(--text-3);
}

.back-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* The name: dim, wrapping within the popover, at most two lines. */
.back-name {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-3);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow-wrap: anywhere;
}
</style>
