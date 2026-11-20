<script setup lang="ts">
import { computed } from 'vue'

/**
 * "Top songs" (QGStats, m7-7 decision 17): horizontal bars, one hue, longest first, each row
 * with its name (truncated with a tooltip) and its time — the value is always printed, so the
 * bar is never the only way to read it.
 */
const props = defineProps<{
  readonly rows: readonly {
    readonly key: string
    readonly name: string
    readonly ms: number
    readonly valueText: string
    /** Other setups: drawn in a neutral tone, not the data hue. */
    readonly muted?: boolean
  }[]
}>()

const max = computed(() => Math.max(1, ...props.rows.map((r) => r.ms)))
</script>

<template>
  <ul class="top-bars" role="list">
    <li v-for="row in rows" :key="row.key" class="row" data-testid="top-row">
      <span class="name" :title="row.name">{{ row.name }}</span>
      <span class="track" aria-hidden="true"
        ><span
          class="fill"
          :class="{ muted: row.muted }"
          :style="{ width: `${(row.ms / max) * 100}%` }"
      /></span>
      <span class="value">{{ row.valueText }}</span>
    </li>
  </ul>
</template>

<style scoped>
.top-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 4px 0 0;
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 140px) minmax(0, 1fr) 64px;
  align-items: center;
  gap: 10px;
  font-size: var(--text-sm);
}

.name {
  overflow: hidden;
  color: var(--text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: rgb(255 255 255 / 6%);
}

.fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px;
  background: rgb(var(--secondary-rgb) / 85%);
}

.fill.muted {
  background: rgb(232 236 246 / 35%);
}

.value {
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
