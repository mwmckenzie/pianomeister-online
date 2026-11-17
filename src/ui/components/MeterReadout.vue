<script setup lang="ts">
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { computed, onBeforeUnmount, ref } from 'vue'

import type { MeterSummary } from '@/core/timing/MeterSummary'

/**
 * A song's meter: the one covering the most bars, a small "+" when it changes, then whatever
 * the parent adds (e.g. "from file"). The "+" opens a scrollable list of every change
 * ("bar 17 · 2/4") on hover after a short delay, on keyboard focus, and on click or tap; it
 * closes when the pointer leaves, on Esc, or on a tap elsewhere.
 */
const props = defineProps<{ readonly summary: MeterSummary }>()

const OPEN_DELAY_MS = 250
const CLOSE_DELAY_MS = 150

const open = ref(false)
const plus = ref<HTMLButtonElement | null>(null)
const label = computed(
  () => `${props.summary.changes} meter ${props.summary.changes === 1 ? 'change' : 'changes'}`,
)
let timer: ReturnType<typeof setTimeout> | undefined

function later(value: boolean, ms: number): void {
  clearTimeout(timer)
  timer = setTimeout(() => (open.value = value), ms)
}

function cancel(): void {
  clearTimeout(timer)
  timer = undefined
}

// Touch fires pointerleave right after a tap, so only a mouse hover opens and closes.
function onEnter(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return
  if (open.value) cancel()
  else later(true, OPEN_DELAY_MS)
}

function onLeave(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return
  if (open.value) later(false, CLOSE_DELAY_MS)
  else cancel()
}

function onFocus(): void {
  if (plus.value?.matches(':focus-visible')) open.value = true
}

// Tabbing on closes it, unless focus moves into the list itself.
function onBlur(event: FocusEvent): void {
  const next = event.relatedTarget
  if (next instanceof Node && next.parentElement?.closest('[data-meter-runs-panel]')) return
  open.value = false
}

function onClick(): void {
  cancel()
  open.value = true
}

// The "+" isn't Reka's own trigger, so focusing or pressing it would count as "outside".
function ignoreOnPlus(event: CustomEvent<{ readonly originalEvent: Event }>): void {
  if (event.detail.originalEvent.target === plus.value) event.preventDefault()
}

function onOpenChange(value: boolean): void {
  cancel()
  open.value = value
}

onBeforeUnmount(cancel)
</script>

<template>
  <span class="meter-readout"
    ><span class="value"
      >{{ summary.main
      }}<PopoverRoot v-if="summary.changes > 0" :open="open" @update:open="onOpenChange"
        ><PopoverAnchor as-child
          ><button
            ref="plus"
            type="button"
            class="plus"
            :aria-label="label"
            :aria-expanded="open"
            aria-haspopup="dialog"
            data-testid="meter-changes"
            @pointerenter="onEnter"
            @pointerleave="onLeave"
            @focus="onFocus"
            @blur="onBlur"
            @click="onClick"
            v-text="'+'"
        /></PopoverAnchor>
        <PopoverPortal>
          <PopoverContent
            class="popover glass pm-animated"
            side="bottom"
            :side-offset="10"
            :collision-padding="16"
            aria-label="Meter changes"
            data-meter-runs-panel
            @open-auto-focus.prevent
            @close-auto-focus.prevent
            @focus-outside="ignoreOnPlus"
            @pointer-down-outside="ignoreOnPlus"
            @pointerenter="onEnter"
            @pointerleave="onLeave"
          >
            <p class="section-caps heading">Meter by bar</p>
            <ul class="runs" data-testid="meter-runs">
              <li v-for="run in summary.runs" :key="run.bar">
                bar {{ run.bar }} · <span class="meter">{{ run.meter }}</span>
              </li>
            </ul>
          </PopoverContent>
        </PopoverPortal></PopoverRoot
      ></span
    ><slot
  /></span>
</template>

<style scoped>
.value {
  white-space: nowrap;
}

/* A superscript-style "+" with a hit area larger than the glyph. */
.plus {
  position: relative;
  top: -0.45em;
  margin: -6px -4px -6px 0;
  padding: 6px 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--secondary);
  font: inherit;
  font-size: 0.8em;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.plus:hover,
.plus[aria-expanded='true'] {
  color: var(--primary);
}

.heading {
  margin-bottom: var(--space-2);
}

.runs {
  max-height: 220px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  color: var(--text-2);
  font-size: var(--text-sm);
  list-style: none;
}

.runs li {
  padding: 4px 0;
}

.meter {
  color: var(--text-1);
}
</style>
