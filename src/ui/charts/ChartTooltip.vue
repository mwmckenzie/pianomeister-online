<script setup lang="ts">
import type { ChartTip } from './ChartTip'

/**
 * The one tooltip of a chart (m7-7 decision 21): above the hovered or focused mark, the value
 * first and strong, the label under it. It enhances, never gates — every value is also in the
 * chart's table.
 */
defineProps<{ readonly tip: ChartTip | null }>()
</script>

<template>
  <div
    v-if="tip"
    class="chart-tooltip"
    role="status"
    :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
    data-testid="chart-tooltip"
  >
    <strong>{{ tip.value }}</strong>
    <span>{{ tip.label }}</span>
  </div>
</template>

<style scoped>
.chart-tooltip {
  position: absolute;
  z-index: 2;
  display: grid;
  gap: 1px;
  padding: 6px 9px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--bg-raised);
  box-shadow: 0 6px 18px rgb(0 0 0 / 45%);
  font-size: var(--text-xs);
  white-space: nowrap;
  pointer-events: none;
  translate: -50% calc(-100% - 8px);
}

strong {
  color: var(--text-strong);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

span {
  color: var(--text-3);
}
</style>
