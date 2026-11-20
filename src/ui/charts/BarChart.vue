<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import type { ChartTip } from './ChartTip'
import ChartTooltip from './ChartTooltip.vue'
import { useElementWidth } from './useElementWidth'

/**
 * Practice minutes as columns (QGStats "Minutes per day", QGWelcomeA "This week"): one hue (the
 * secondary colour), the current day or period in the primary colour, empty days as a faint
 * stub. Bars grow from one baseline with rounded tops and square bases; each is a hover and
 * keyboard-focus target with its own tooltip. With `grid`, a recessive y grid and minute labels.
 */
const props = withDefaults(
  defineProps<{
    readonly bars: readonly {
      readonly key: string
      /** Minutes. */
      readonly value: number
      /** Tooltip: what the bar is ("Thu 19 Nov"). */
      readonly label: string
      readonly valueText: string
      readonly current: boolean
      /** A label under the bar ("M", "21 Oct"); none for most bars of a long chart. */
      readonly axis?: string
      /** A day still to come this week: a stub, no tooltip. */
      readonly future?: boolean
    }[]
    /** The plot's height, px (labels go below it). */
    readonly height?: number
    readonly grid?: boolean
    readonly maxBarWidth?: number
    readonly label: string
  }>(),
  { height: 150, grid: false, maxBarWidth: 24 },
)

const box = useTemplateRef<HTMLElement>('box')
const width = useElementWidth(box, 600)
const tip = ref<ChartTip | null>(null)
const hovered = ref<string | null>(null)

const NICE = [1, 2, 5, 10, 15, 20, 30, 60, 90, 120, 180, 240, 300, 600, 900, 1200, 1800, 3000]
/** Two gridlines above zero at a round number of minutes. */
const step = computed(() => {
  const max = Math.max(1, ...props.bars.map((b) => b.value))
  return NICE.find((n) => n * 2 >= max) ?? Math.ceil(max / 2)
})
const top = computed(() => step.value * 2)
const gutter = computed(() => (props.grid ? 34 : 0))

const layout = computed(() => {
  const n = Math.max(1, props.bars.length)
  const plot = Math.max(10, width.value - gutter.value)
  const slot = plot / n
  const barWidth = Math.max(2, Math.min(props.maxBarWidth, slot - 3))
  return props.bars.map((bar, i) => {
    const x = gutter.value + i * slot + (slot - barWidth) / 2
    const empty = bar.value <= 0 || bar.future === true
    const h = empty ? 3 : Math.max(3, (bar.value / top.value) * props.height)
    return {
      ...bar,
      x,
      w: barWidth,
      h,
      y: props.height - h,
      slotX: gutter.value + i * slot,
      slot,
      empty,
    }
  })
})

/** A column with a rounded top (radius ≤ 4 px) and a square base on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  const base = props.height
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`
}

function show(bar: (typeof layout.value)[number]): void {
  hovered.value = bar.key
  tip.value = bar.future
    ? null
    : { value: bar.valueText, label: bar.label, x: bar.x + bar.w / 2, y: bar.y }
}

function hide(key: string): void {
  if (hovered.value === key) {
    hovered.value = null
    tip.value = null
  }
}

const gridLines = computed(() =>
  props.grid
    ? [0, step.value, top.value].map((m) => ({
        y: props.height - (m / top.value) * props.height,
        text: m === 0 ? '0' : m >= 60 && m % 60 === 0 ? `${m / 60} h` : String(m),
      }))
    : [],
)
</script>

<template>
  <div ref="box" class="bar-chart">
    <svg
      :width="width"
      :height="height + 18"
      :viewBox="`0 -4 ${width} ${height + 22}`"
      role="img"
      :aria-label="label"
    >
      <g v-for="line in gridLines" :key="line.y" aria-hidden="true">
        <line
          :x1="gutter"
          :x2="width"
          :y1="line.y"
          :y2="line.y"
          :class="line.text === '0' ? 'baseline' : 'gridline'"
        />
        <text :x="gutter - 8" :y="line.y + 4" text-anchor="end" class="axis">{{ line.text }}</text>
      </g>
      <g
        v-for="bar in layout"
        :key="bar.key"
        class="bar"
        :class="{ current: bar.current, empty: bar.empty, hovered: hovered === bar.key }"
        :tabindex="bar.future ? undefined : 0"
        :aria-label="bar.future ? undefined : `${bar.label}: ${bar.valueText}`"
        data-testid="chart-bar"
        @pointerenter="show(bar)"
        @pointerleave="hide(bar.key)"
        @focus="show(bar)"
        @blur="hide(bar.key)"
      >
        <!-- The hit area is the whole slot, not just the painted column. -->
        <rect :x="bar.slotX" :y="0" :width="bar.slot" :height="height" class="hit" />
        <path :d="columnPath(bar.x, bar.y, bar.w, bar.h)" class="mark" />
        <text
          v-if="bar.axis"
          :x="bar.x + bar.w / 2"
          :y="height + 14"
          text-anchor="middle"
          class="axis"
        >
          {{ bar.axis }}
        </text>
      </g>
    </svg>
    <ChartTooltip :tip="tip" />
  </div>
</template>

<style scoped>
.bar-chart {
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

.baseline {
  stroke: rgb(255 255 255 / 12%);
}

.axis {
  fill: var(--text-3);
  font-size: 10px;
}

.hit {
  fill: transparent;
}

.mark {
  fill: rgb(var(--secondary-rgb) / 82%);
  transition: fill var(--dur-fast);
}

.bar.current .mark {
  fill: var(--primary);
}

.bar.empty .mark {
  fill: rgb(255 255 255 / 8%);
}

.bar.hovered .mark {
  fill: var(--secondary);
}

.bar.current.hovered .mark {
  fill: rgb(var(--primary-rgb) / 85%);
}

.bar:focus {
  outline: none;
}

.bar:focus-visible .mark {
  stroke: var(--text-strong);
  stroke-width: 1.5px;
}
</style>
