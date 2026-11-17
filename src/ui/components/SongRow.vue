<script setup lang="ts">
/**
 * One song in the picker or the library: the title (and an optional subtitle) in the first
 * column, then the parent's cells. Columns come from `--song-columns` on the list, so the header
 * above uses the same grid. Long text stays on one line with an ellipsis, and its full text is
 * in a tooltip. Attributes (role, aria-selected, data-testid, events) go to the row.
 */
withDefaults(
  defineProps<{
    readonly title: string
    readonly subtitle?: string
    readonly selected: boolean
    readonly as?: string
  }>(),
  { subtitle: '', as: 'div' },
)
</script>

<template>
  <component :is="as" class="song-row" :class="{ selected }">
    <span class="names">
      <span class="title" :title="title">{{ title }}</span>
      <span v-if="subtitle" class="subtitle" :title="subtitle">{{ subtitle }}</span>
    </span>
    <slot />
  </component>
</template>

<style scoped>
.song-row {
  display: grid;
  grid-template-columns: var(--song-columns);
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: var(--song-row-padding, 10px 16px);
  color: var(--text-1);
  font-size: var(--text-md);
  cursor: pointer;
}

.song-row:hover {
  background: var(--field);
}

.song-row.selected {
  background: rgb(var(--primary-rgb) / 14%);
  color: var(--text-strong);
}

.song-row:focus-visible {
  box-shadow: inset var(--focus-ring-field);
}

.names {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.title,
.subtitle,
.song-row :slotted(.cell-text) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  font-weight: var(--weight-medium);
}

.subtitle {
  color: var(--text-3);
  font-size: var(--text-xs);
}

.song-row :slotted(.num) {
  font-size: var(--text-sm);
  text-align: right;
  white-space: nowrap;
}

.song-row :slotted(.muted) {
  color: var(--text-3);
}
</style>
