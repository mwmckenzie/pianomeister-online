<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { shortDayLabel } from '../format/shortDayLabel'
import type { ChartTip } from './ChartTip'
import ChartTooltip from './ChartTooltip.vue'
import { useElementWidth } from './useElementWidth'

/**
 * "Tempo progress" (QGStats, m7-7 decision 20): the highest tempo per week as a 2 px line with
 * 8 px points ringed in the card colour, the latest value labelled, a recessive grid at round
 * percentages. Each point is a hover and focus target.
 */
const props = defineProps<{
  readonly points: readonly { readonly week: string; readonly tempo: number }[]
  readonly label: string
}>()

const HEIGHT = 130
const LEFT = 38
const box = useTemplateRef<HTMLElement>('box')
const width = useElementWidth(box, 390)
const tip = ref<ChartTip | null>(null)

const scale = computed(() => {
  const values = props.points.map((p) => p.tempo)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const min = Math.max(0, Math.floor((lo - 5) / 20) * 20)
  const max = Math.max(min + 20, Math.ceil((hi + 5) / 20) * 20)
  return { min, max }
})
const ticks = computed(() => {
  const { min, max } = scale.value
  const step = max - min > 60 ? 40 : 20
  const out: number[] = []
  for (let t = min; t <= max; t += step) out.push(t)
  return out
})
const y = (tempo: number) =>
  HEIGHT - ((tempo - scale.value.min) / (scale.value.max - scale.value.min)) * HEIGHT

const placed = computed(() => {
  const n = props.points.length
  const span = Math.max(1, width.value - LEFT - 14)
  return props.points.map((p, i) => ({
    ...p,
    x: LEFT + 4 + (n === 1 ? span / 2 : (i / (n - 1)) * span),
    y: y(p.tempo),
  }))
})
const path = computed(() =>
  placed.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
)
const last = computed(() => placed.value[placed.value.length - 1])

function show(p: (typeof placed.value)[number]): void {
  tip.value = {
    value: `${p.tempo}%`,
    label: `Week of ${shortDayLabel(p.week)}`,
    x: p.x,
    y: p.y - 4,
  }
}
</script>

<template>
  <div ref="box" class="tempo-line">
    <svg
      :width="width"
      :height="HEIGHT + 20"
      :viewBox="`0 -6 ${width} ${HEIGHT + 26}`"
      role="img"
      :aria-label="label"
    >
      <g v-for="t in ticks" :key="t" aria-hidden="true">
        <line :x1="LEFT" :x2="width" :y1="y(t)" :y2="y(t)" class="gridline" />
        <text :x="LEFT - 8" :y="y(t) + 4" text-anchor="end" class="axis">{{ t }}%</text>
      </g>
      <path :d="path" class="line" />
      <circle
        v-for="p in placed"
        :key="p.week"
        :cx="p.x"
        :cy="p.y"
        r="4"
        class="point"
        tabindex="0"
        :aria-label="`Week of ${shortDayLabel(p.week)}: ${p.tempo}%`"
        data-testid="tempo-point"
        @pointerenter="show(p)"
        @pointerleave="tip = null"
        @focus="show(p)"
        @blur="tip = null"
      />
      <text
        v-if="last"
        :x="last.x - 6"
        :y="last.y - 10"
        text-anchor="end"
        class="latest"
        data-testid="tempo-latest"
      >
        {{ last.tempo }}%
      </text>
      <text v-if="placed[0]" :x="LEFT + 4" :y="HEIGHT + 16" class="axis">
        {{ shortDayLabel(placed[0].week) }}
      </text>
      <text :x="width - 6" :y="HEIGHT + 16" text-anchor="end" class="axis">This week</text>
    </svg>
    <ChartTooltip :tip="tip" />
  </div>
</template>

<style scoped>
.tempo-line {
  position: relative;
  min-width: 0;
}

svg {
  display: block;
  overflow: visible;
}

.gridline {
  stroke: rgb(255 255 255 / 6%);
}

.axis {
  fill: var(--text-3);
  font-size: 10px;
}

.line {
  fill: none;
  stroke: var(--secondary);
  stroke-width: 2px;
  stroke-linejoin: round;
}

.point {
  fill: var(--secondary);
  stroke: rgb(18 24 48);
  stroke-width: 2px;
  cursor: default;
}

.point:focus {
  outline: none;
}

.point:hover,
.point:focus-visible {
  r: 5px;
}

.latest {
  fill: var(--text-strong);
  font-size: 11px;
}
</style>
