<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

/**
 * Thin song timeline: progress in the primary colour, bar ticks, the loop region (secondary
 * colour) and a draggable playhead with a soft glow. Dragging or
 * clicking seeks to the start of the bar under the pointer, on release; the keyboard steps by
 * bar. Seeking is always by bar (CLAUDE.md: no raw seconds in UI code).
 */
const props = withDefaults(
  defineProps<{
    /** Playhead position, 0–1 of the song. */
    readonly position: number
    /** Loop region (0–1 of the song) and its first and last bars, shown below it. */
    readonly loop: {
      readonly from: number
      readonly to: number
      readonly startBar: number
      readonly endBar: number
    } | null
    /** Bar starts to mark, 0–1 of the song (thinned out for long songs). */
    readonly ticks: readonly number[]
    readonly bar: number
    readonly firstBar: number
    readonly lastBar: number
    /** The bar at a 0–1 position (from the bar map). */
    readonly barAt: (fraction: number) => number
    /** Off while listening: ← and → are song keys there, with the focus on the timeline or not. */
    readonly horizontalKeys?: boolean
  }>(),
  { horizontalKeys: true },
)
const emit = defineEmits<{ seekBar: [bar: number] }>()

const track = useTemplateRef<HTMLElement>('track')
const dragging = ref<number | null>(null)
const shown = computed(() => dragging.value ?? props.position)

function fractionAt(event: PointerEvent): number {
  const rect = track.value?.getBoundingClientRect()
  if (rect === undefined || rect.width === 0) return 0
  return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  dragging.value = fractionAt(event)
}

function onPointerMove(event: PointerEvent): void {
  if (dragging.value !== null) dragging.value = fractionAt(event)
}

function onPointerUp(event: PointerEvent): void {
  if (dragging.value === null) return
  const fraction = fractionAt(event)
  dragging.value = null
  emit('seekBar', props.barAt(fraction))
}

function onKeyDown(event: KeyboardEvent): void {
  const step: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }
  if (!props.horizontalKeys && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return
  let target: number | null = null
  if (event.key in step) target = props.bar + (step[event.key] ?? 0)
  else if (event.key === 'Home') target = props.firstBar
  else if (event.key === 'End') target = props.lastBar
  if (target === null) return
  // Handled here; the player's global shortcuts skip prevented events.
  event.preventDefault()
  emit('seekBar', Math.min(props.lastBar, Math.max(props.firstBar, target)))
}
</script>

<template>
  <div
    ref="track"
    class="timeline"
    role="slider"
    tabindex="0"
    aria-label="Song position (bar)"
    :aria-valuemin="firstBar"
    :aria-valuemax="lastBar"
    :aria-valuenow="bar"
    :aria-valuetext="`Bar ${bar} of ${lastBar}`"
    data-testid="timeline"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="dragging = null"
    @keydown="onKeyDown"
  >
    <span class="rail" />
    <span
      v-for="(t, i) in ticks"
      :key="i"
      class="tick"
      :style="{ left: `${t * 100}%` }"
      aria-hidden="true"
    />
    <span
      v-if="loop"
      class="loop"
      :style="{ left: `${loop.from * 100}%`, width: `${(loop.to - loop.from) * 100}%` }"
      data-testid="timeline-loop"
    />
    <template v-if="loop">
      <span
        class="loop-bar"
        :style="{ left: `${loop.from * 100}%` }"
        data-testid="timeline-loop-start"
        >{{ loop.startBar }}</span
      >
      <span
        v-if="loop.endBar !== loop.startBar"
        class="loop-bar"
        :style="{ left: `${loop.to * 100}%` }"
        data-testid="timeline-loop-end"
        >{{ loop.endBar }}</span
      >
    </template>
    <span class="played" :style="{ width: `${shown * 100}%` }" />
    <!-- Outside an active loop is out of bounds (seeks there land on the loop start): dimmed,
         ticks still showing through. -->
    <template v-if="loop">
      <span
        v-if="loop.from > 0"
        class="outside"
        :style="{ left: 0, width: `${loop.from * 100}%` }"
        data-testid="timeline-outside"
      />
      <span
        v-if="loop.to < 1"
        class="outside"
        :style="{ left: `${loop.to * 100}%`, right: 0 }"
        data-testid="timeline-outside"
      />
    </template>
    <span
      class="head"
      :class="{ active: dragging !== null }"
      :style="{ left: `${shown * 100}%` }"
    />
  </div>
</template>

<style scoped>
/* A thin line along the top edge of the stage; the hit area is the full 28 px strip. */
.timeline {
  position: relative;
  height: 28px;
  cursor: pointer;
  touch-action: none;
}

.timeline:focus-visible {
  box-shadow: none;
  outline: 1px solid rgb(var(--primary-rgb) / 50%);
  outline-offset: 2px;
}

.rail,
.played {
  position: absolute;
  top: 12px;
  height: 3px;
  border-radius: 2px;
}

.rail {
  right: 0;
  left: 0;
  background: rgb(232 236 246 / 16%);
}

.tick {
  position: absolute;
  top: 12px;
  width: 1px;
  height: 3px;
  background: rgb(5 7 15 / 90%);
}

.played {
  left: 0;
  background: linear-gradient(90deg, rgb(var(--primary-rgb) / 30%), var(--primary));
}

.loop {
  position: absolute;
  top: 7px;
  height: 13px;
  border: 1px solid rgb(var(--secondary-rgb) / 45%);
  border-radius: 4px;
  background: rgb(var(--secondary-rgb) / 12%);
}

.outside {
  position: absolute;
  top: 10px;
  height: 7px;
  background: rgb(5 7 15 / 45%);
  pointer-events: none;
}

.loop-bar {
  position: absolute;
  top: 22px;
  color: var(--secondary);
  font-size: 10px;
  line-height: 1;
  text-shadow: var(--text-shadow-hud);
  translate: -50% 0;
  pointer-events: none;
}

.head {
  position: absolute;
  top: 7px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--text-strong);
  box-shadow: 0 0 12px rgb(var(--primary-rgb) / 90%);
  translate: -50% 0;
  transition: scale var(--dur-fast);
}

.head.active,
.timeline:hover .head {
  scale: calc(1 + var(--move) * 0.15);
}
</style>
