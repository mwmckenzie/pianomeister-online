<script setup lang="ts">
/**
 * One of the stats page's six headline numbers (QGStats, m7-7 decision 15): a label, a large
 * number with a small unit, and a line under it (the change vs the previous window, or a note
 * like "current 4"). A rise reads in the secondary colour, as in the source; the words carry it.
 */
defineProps<{
  readonly label: string
  readonly value: string
  readonly unit?: string
  readonly note?: string
  readonly up?: boolean
}>()
</script>

<template>
  <div class="tile glass" data-testid="headline">
    <p class="label">{{ label }}</p>
    <p class="number">
      <span class="value" data-testid="headline-value">{{ value }}</span>
      <span v-if="unit" class="unit">{{ unit }}</span>
    </p>
    <p class="note" :class="{ up }" data-testid="headline-note">{{ note || ' ' }}</p>
  </div>
</template>

<style scoped>
.tile {
  min-width: 0;
  padding: 12px 14px;
  border-radius: 14px;
}

p {
  margin: 0;
}

.label {
  overflow: hidden;
  color: var(--text-2);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.number {
  margin-top: 2px;
  white-space: nowrap;
}

.value {
  font-size: 24px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}

.unit {
  margin-left: 4px;
  color: var(--text-3);
  font-size: 12px;
}

.note {
  overflow: hidden;
  color: var(--text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note.up {
  color: var(--secondary);
}
</style>
