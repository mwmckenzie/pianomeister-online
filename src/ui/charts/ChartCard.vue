<script setup lang="ts">
import { ref } from 'vue'

/**
 * A glass card holding one chart (QGStats): a caps title, an optional note or control at the
 * right, and "Show as table" (m7-7 decision 21) switching the chart for its table, so every
 * value is reachable without hovering and without colour.
 */
defineProps<{ readonly title: string }>()
const asTable = ref(false)
</script>

<template>
  <section class="chart-card glass" :aria-label="title">
    <header class="head">
      <h2 class="section-caps">{{ title }}</h2>
      <span class="aside"><slot name="aside" /></span>
      <button
        v-if="$slots.table"
        type="button"
        class="toggle"
        :aria-pressed="asTable"
        data-testid="show-table"
        @click="asTable = !asTable"
      >
        {{ asTable ? 'Show chart' : 'Show as table' }}
      </button>
    </header>
    <div v-if="asTable" class="table-wrap" data-testid="chart-table"><slot name="table" /></div>
    <slot v-else />
  </section>
</template>

<style scoped>
.chart-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  padding: 14px 16px;
  border-radius: 14px;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.head .section-caps {
  margin: 0;
}

.aside {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  color: var(--text-3);
  font-size: var(--text-xs);
}

.toggle {
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-3);
  font: inherit;
  font-size: var(--text-xs);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.toggle:hover {
  color: var(--text-1);
}

.table-wrap {
  min-height: 0;
  overflow: auto;
}

.table-wrap :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.table-wrap :deep(th),
.table-wrap :deep(td) {
  padding: 4px 8px 4px 0;
  border-bottom: 1px solid var(--divider);
  color: var(--text-2);
  font-weight: normal;
  text-align: left;
}

.table-wrap :deep(th) {
  color: var(--text-3);
}

.table-wrap :deep(td.num),
.table-wrap :deep(th.num) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
