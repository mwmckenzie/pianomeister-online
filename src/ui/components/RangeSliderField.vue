<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'

/**
 * A two-thumb slider for a range, drawn and announced by Reka's Slider. Pointer and keys are
 * ours: the thumb you grab (or focus) stays the one that moves, and moving it into the other
 * pushes that one along (the parent applies the change, e.g. adjustLoopRange). Reka would
 * re-sort the values and hand the drag over to the other thumb instead.
 */
const props = defineProps<{
  readonly start: number
  readonly end: number
  readonly min: number
  readonly max: number
  readonly step?: number
  /** Accessible names of the two thumbs. */
  readonly labels: readonly [string, string]
  readonly valueTexts?: readonly [string, string]
}>()
/**
 * `change` follows the thumb, every step of a drag or key; `commit` marks where the user
 * settled: the pointer let go, or ~400 ms without another key step, or the thumb losing focus
 * (the loop applies only then, brief decision 8).
 */
const emit = defineEmits<{ change: [change: { start: number } | { end: number }]; commit: [] }>()

/** Thumb diameter: Reka keeps thumbs inside the track ("contain"), so values map inset by half. */
const THUMB = 20
const value = computed(() => [props.start, props.end])
const field = useTemplateRef<HTMLElement>('field')
const dragging = ref<'start' | 'end' | null>(null)

/** Key steps settle after this pause, so holding or tapping an arrow applies once. */
const KEY_SETTLE_MS = 400
let keyTimer: ReturnType<typeof setTimeout> | undefined

function settleKeys(): void {
  clearTimeout(keyTimer)
  keyTimer = undefined
  emit('commit')
}

/** Focus leaving a thumb with key steps still pending applies them at once. */
function onThumbBlur(): void {
  if (keyTimer !== undefined) settleKeys()
}

onBeforeUnmount(onThumbBlur)

function emitValue(which: 'start' | 'end', raw: number): void {
  const step = props.step ?? 1
  const v = Math.min(props.max, Math.max(props.min, Math.round(raw / step) * step))
  if (v === (which === 'start' ? props.start : props.end)) return
  emit('change', which === 'start' ? { start: v } : { end: v })
}

function valueAt(clientX: number): number {
  const track = field.value?.querySelector('.track')?.getBoundingClientRect()
  if (track === undefined || track.width <= THUMB) return props.min
  const fraction = (clientX - track.left - THUMB / 2) / (track.width - THUMB)
  return props.min + Math.min(1, Math.max(0, fraction)) * (props.max - props.min)
}

function thumbs(): HTMLElement[] {
  return [...(field.value?.querySelectorAll<HTMLElement>('[role="slider"]') ?? [])]
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  // Ours, not Reka's (see above).
  event.preventDefault()
  event.stopPropagation()
  const target = valueAt(event.clientX)
  // The nearer thumb; with both on one bar, the side of the pointer decides.
  const toStart = Math.abs(target - props.start)
  const toEnd = Math.abs(target - props.end)
  const which = toStart < toEnd || (toStart === toEnd && target < props.start) ? 'start' : 'end'
  dragging.value = which
  field.value?.setPointerCapture(event.pointerId)
  thumbs()[which === 'start' ? 0 : 1]?.focus()
  emitValue(which, target)
}

function onPointerMove(event: PointerEvent): void {
  if (dragging.value !== null) emitValue(dragging.value, valueAt(event.clientX))
}

function onPointerEnd(event: PointerEvent): void {
  if (dragging.value === null) return
  dragging.value = null
  field.value?.releasePointerCapture(event.pointerId)
  emit('commit')
}

const STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 10,
  PageDown: -10,
}

/** Keys move the focused thumb, pushing the other along (Reka sends Home/End to fixed thumbs). */
function onThumbKeyDown(event: KeyboardEvent, which: 'start' | 'end'): void {
  const current = which === 'start' ? props.start : props.end
  let next: number
  if (event.key === 'Home') next = props.min
  else if (event.key === 'End') next = props.max
  else if (event.key in STEPS) next = current + (STEPS[event.key] ?? 0) * (props.step ?? 1)
  else return
  event.preventDefault()
  event.stopPropagation()
  emitValue(which, next)
  clearTimeout(keyTimer)
  keyTimer = setTimeout(settleKeys, KEY_SETTLE_MS)
}
</script>

<template>
  <div
    ref="field"
    class="range-field"
    @pointerdown.capture="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
  >
    <SliderRoot
      class="range-slider"
      :model-value="value"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :min-steps-between-thumbs="0"
    >
      <SliderTrack class="track">
        <SliderRange class="range" />
      </SliderTrack>
      <SliderThumb
        class="thumb"
        :aria-label="labels[0]"
        :aria-valuetext="valueTexts?.[0]"
        data-testid="range-start"
        @keydown="onThumbKeyDown($event, 'start')"
        @blur="onThumbBlur"
      />
      <SliderThumb
        class="thumb"
        :aria-label="labels[1]"
        :aria-valuetext="valueTexts?.[1]"
        data-testid="range-end"
        @keydown="onThumbKeyDown($event, 'end')"
        @blur="onThumbBlur"
      />
    </SliderRoot>
  </div>
</template>

<style scoped>
.range-field {
  touch-action: none;
}

.range-slider {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  touch-action: none;
  user-select: none;
}

.track {
  position: relative;
  flex: 1;
  height: 6px;
  border-radius: var(--radius-full);
  background: rgb(201 210 232 / 16%);
}

.range {
  position: absolute;
  height: 100%;
  border-radius: inherit;
  background: rgb(var(--secondary-rgb) / 85%);
}

.thumb {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--secondary);
  border-radius: 50%;
  background: var(--bg-raised);
  box-shadow: 0 1px 4px rgb(0 0 0 / 45%);
  cursor: grab;
}

.thumb:focus-visible {
  box-shadow: var(--focus-ring);
}
</style>
