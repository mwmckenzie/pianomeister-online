<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import type { HeatmapCell } from '@/core/insights/HeatmapCell'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'

import { dayLabel } from '../format/dayLabel'
import type { ChartTip } from './ChartTip'
import ChartTooltip from './ChartTooltip.vue'
import { useElementWidth } from './useElementWidth'

/**
 * A practice calendar (QGWelcomeA "Last 12 weeks", QGStats "Last 6 months"): one column per
 * week, one hue in five fixed steps (none, 1–14, 15–29, 30–44, 45+ minutes; m7-7 decision 8),
 * today in the primary colour, and a Less–More legend. Each day has a hover tooltip; the
 * card's table lists them all.
 */
const props = withDefaults(
  defineProps<{
    readonly weeks: readonly (readonly HeatmapCell[])[]
    readonly cell?: number
    readonly gap?: number
    readonly label: string
    /** Shrink the cells (down to 6 px) so a long calendar fits its card without scrolling. */
    readonly fit?: boolean
  }>(),
  { cell: 13, gap: 4, fit: false },
)

const tip = ref<ChartTip | null>(null)
const box = useTemplateRef<HTMLElement>('box')
const available = useElementWidth(box, 10_000)
const size = computed(() => {
  const natural = props.cell + props.gap
  if (!props.fit) return { cell: props.cell, pitch: natural }
  const pitch = Math.max(
    6 + props.gap,
    Math.min(natural, Math.floor((available.value + props.gap) / props.weeks.length)),
  )
  return { cell: pitch - props.gap, pitch }
})
const pitch = computed(() => size.value.pitch)
const cellSize = computed(() => size.value.cell)
const width = computed(() => props.weeks.length * pitch.value - props.gap)
const height = computed(() => 7 * pitch.value - props.gap)

function show(cell: HeatmapCell, x: number, y: number): void {
  tip.value = {
    value: cell.ms > 0 ? formatPracticeTime(cell.ms) : 'No practice',
    label: dayLabel(cell.key),
    x: x + cellSize.value / 2,
    y,
  }
}
</script>

<template>
  <div ref="box" class="heatmap">
    <div class="plot">
      <svg :width="width" :height="height" role="img" :aria-label="label">
        <template v-for="(week, w) in weeks" :key="w">
          <template v-for="(day, d) in week" :key="day.key">
            <rect
              v-if="!day.future"
              :x="w * pitch"
              :y="d * pitch"
              :width="cellSize"
              :height="cellSize"
              rx="2.5"
              class="day"
              :class="[`level-${day.level}`, { today: day.today }]"
              :data-level="day.level"
              data-testid="heatmap-day"
              @pointerenter="show(day, w * pitch, d * pitch)"
              @pointerleave="tip = null"
            />
          </template>
        </template>
      </svg>
      <ChartTooltip :tip="tip" />
    </div>
    <p class="legend" aria-hidden="true">
      Less
      <span v-for="level in 5" :key="level" class="swatch" :class="`level-${level - 1}`" />
      More
    </p>
  </div>
</template>

<style scoped>
.heatmap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plot {
  position: relative;
  width: fit-content;
}

svg {
  display: block;
}

.level-0 {
  fill: rgb(255 255 255 / 6%);
  background: rgb(255 255 255 / 6%);
}

.level-1 {
  fill: rgb(var(--secondary-rgb) / 22%);
  background: rgb(var(--secondary-rgb) / 22%);
}

.level-2 {
  fill: rgb(var(--secondary-rgb) / 45%);
  background: rgb(var(--secondary-rgb) / 45%);
}

.level-3 {
  fill: rgb(var(--secondary-rgb) / 70%);
  background: rgb(var(--secondary-rgb) / 70%);
}

.level-4 {
  fill: var(--secondary);
  background: var(--secondary);
}

.day.today {
  fill: var(--primary);
}

.day:hover {
  stroke: var(--text-strong);
  stroke-width: 1px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--text-3);
  font-size: 11px;
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
</style>
