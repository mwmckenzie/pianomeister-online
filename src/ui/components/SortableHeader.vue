<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/**
 * A column header that sorts by its field: shows the direction while active. The parent sets
 * aria-sort on the header cell.
 */
defineProps<{
  readonly label: string
  readonly active: boolean
  readonly direction: 'asc' | 'desc'
  readonly align?: 'start' | 'end'
  /** Mixed case, as the picker's practice columns are in the QGPicker source. */
  readonly plain?: boolean
}>()
defineEmits<{ sort: [] }>()
</script>

<template>
  <button
    type="button"
    class="sortable-header"
    :class="[{ active, plain }, align === 'end' ? 'end' : 'start']"
    @click="$emit('sort')"
  >
    <slot>{{ label }}</slot>
    <AppIcon
      v-if="active"
      :name="direction === 'asc' ? 'arrowUp' : 'arrowDown'"
      :size="12"
      class="arrow"
    />
    <span v-if="active" class="visually-hidden">
      , sorted {{ direction === 'asc' ? 'ascending' : 'descending' }}
    </span>
  </button>
</template>

<style scoped>
.sortable-header {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: var(--space-1) 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-4);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
}

/* Numeric columns: the label sits flush right, above the right-aligned values. */
.end {
  flex-direction: row-reverse;
  justify-self: end;
}

.plain {
  font-weight: var(--weight-medium);
  letter-spacing: 0;
  text-transform: none;
}

.plain.active {
  font-weight: var(--weight-semibold);
}

.sortable-header:hover,
.active {
  color: var(--primary);
}
</style>
