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
    /** A hint after the subtitle, in the warning colour ("Check hands · 58 %"). */
    readonly hint?: string
    readonly selected: boolean
    readonly as?: string
    /** A small tag after the title, e.g. "New" for a song just uploaded. */
    readonly tag?: string
    /** A short highlight pulse (a song just uploaded or pointed at). */
    readonly pulse?: boolean
  }>(),
  { subtitle: '', hint: '', as: 'div', tag: '', pulse: false },
)
</script>

<template>
  <component :is="as" class="song-row" :class="{ selected, pulse }">
    <span class="names">
      <span class="title-line">
        <span class="title" :title="title">{{ title }}</span>
        <span v-if="tag" class="tag" data-testid="song-row-tag">{{ tag }}</span>
      </span>
      <span
        v-if="subtitle || hint"
        class="subtitle"
        :title="[subtitle, hint].filter(Boolean).join(' · ')"
        >{{ subtitle }}<template v-if="subtitle && hint"> · </template
        ><span v-if="hint" class="hint" data-testid="song-row-hint">{{ hint }}</span></span
      >
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

.title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: rgb(var(--secondary-rgb) / 16%);
  color: var(--secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

/* A song just uploaded or pointed at (decision 82): a short secondary glow, about 1.2 s. */
.song-row.pulse {
  animation: row-pulse 1.2s var(--ease-out);
}

@keyframes row-pulse {
  0% {
    box-shadow: inset 0 0 0 2px rgb(var(--secondary-rgb) / 0%);
    background: rgb(var(--secondary-rgb) / 0%);
  }
  25% {
    box-shadow: inset 0 0 0 2px rgb(var(--secondary-rgb) / 85%);
    background: rgb(var(--secondary-rgb) / 22%);
  }
  100% {
    box-shadow: inset 0 0 0 2px rgb(var(--secondary-rgb) / 0%);
  }
}

/* Reduced motion: the colour fades in and out, nothing else changes. */
:root[data-motion='reduced'] .song-row.pulse {
  animation-name: row-pulse-fade;
}

@keyframes row-pulse-fade {
  0%,
  100% {
    background: rgb(var(--secondary-rgb) / 0%);
  }
  30% {
    background: rgb(var(--secondary-rgb) / 22%);
  }
}

.subtitle {
  color: var(--text-3);
  font-size: var(--text-xs);
}

.hint {
  color: var(--warning);
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
