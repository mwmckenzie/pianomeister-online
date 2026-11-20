<script setup lang="ts">
import { computed, ref } from 'vue'

import { TIME_BANDS } from '@/core/insights/TIME_BANDS'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'

import type { ChartTip } from './ChartTip'
import ChartTooltip from './ChartTooltip.vue'

/**
 * "When you practise" (QGStats, m7-7 decision 19): weekdays (from the locale's first day) by
 * time-of-day band, one hue in steps relative to the busiest cell. Each cell has a hover
 * tooltip; the card's table has the numbers.
 */
const props = defineProps<{
  /** ms per weekday (row 0 = Sunday) and band. */
  readonly grid: readonly (readonly number[])[]
  readonly weekStart: number
}>()

const CELL = 22
const PITCH = 25
const LEFT = 34
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const tip = ref<ChartTip | null>(null)
const rows = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const weekday = (props.weekStart + i) % 7
    return { weekday, name: NAMES[weekday] ?? '', cells: props.grid[weekday] ?? [] }
  }),
)
const max = computed(() => Math.max(0, ...props.grid.flat()))

/** Five steps: none, then quarters of the busiest cell. */
function level(ms: number): number {
  if (ms <= 0 || max.value <= 0) return 0
  return Math.min(4, Math.ceil((ms / max.value) * 4))
}

function show(name: string, band: number, ms: number, x: number, y: number): void {
  tip.value = {
    value: ms > 0 ? formatPracticeTime(ms) : 'No practice',
    label: `${name} ${TIME_BANDS[band]?.label.toLowerCase() ?? ''}`,
    x: x + CELL / 2,
    y,
  }
}
</script>

<template>
  <div class="weekday-grid">
    <svg
      :width="LEFT + 5 * PITCH"
      :height="7 * PITCH + 18"
      role="img"
      aria-label="Practice by weekday and time of day"
    >
      <g v-for="(row, r) in rows" :key="row.weekday">
        <text :x="LEFT - 6" :y="r * PITCH + 15" text-anchor="end" class="axis">{{ row.name }}</text>
        <rect
          v-for="(ms, b) in row.cells"
          :key="b"
          :x="LEFT + b * PITCH"
          :y="r * PITCH"
          :width="CELL"
          :height="CELL"
          rx="3"
          class="cell"
          :class="`level-${level(ms)}`"
          data-testid="weekday-cell"
          @pointerenter="show(row.name, b, ms, LEFT + b * PITCH, r * PITCH)"
          @pointerleave="tip = null"
        />
      </g>
      <text
        v-for="(band, b) in TIME_BANDS"
        :key="band.id"
        :x="LEFT + b * PITCH + CELL / 2"
        :y="7 * PITCH + 12"
        text-anchor="middle"
        class="axis"
      >
        {{ band.short }}
      </text>
    </svg>
    <ChartTooltip :tip="tip" />
  </div>
</template>

<style scoped>
.weekday-grid {
  position: relative;
  width: fit-content;
}

svg {
  display: block;
}

.axis {
  fill: var(--text-3);
  font-size: 10px;
}

.level-0 {
  fill: rgb(255 255 255 / 6%);
}

.level-1 {
  fill: rgb(var(--secondary-rgb) / 22%);
}

.level-2 {
  fill: rgb(var(--secondary-rgb) / 45%);
}

.level-3 {
  fill: rgb(var(--secondary-rgb) / 70%);
}

.level-4 {
  fill: var(--secondary);
}

.cell:hover {
  stroke: var(--text-strong);
  stroke-width: 1px;
}
</style>
