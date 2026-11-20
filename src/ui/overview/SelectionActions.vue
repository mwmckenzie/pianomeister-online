<script setup lang="ts">
import { computed } from 'vue'

import type { LoopRange } from '@/core/transport/LoopRange'

import AppIcon from '../components/AppIcon.vue'

/**
 * The action bar beside an overview selection (brief decision 103, QGOverviewA): what's
 * selected, **Loop these bars**, **Save as bookmark** and ×. Nothing changes until one is chosen.
 */
const props = defineProps<{ readonly selection: LoopRange; readonly saveKey: string }>()
const emit = defineEmits<{ loop: []; save: []; clear: [] }>()

const bars = computed(() => props.selection.endBar - props.selection.startBar + 1)
const range = computed(() =>
  props.selection.startBar === props.selection.endBar
    ? `Bar ${props.selection.startBar}`
    : `Bars ${props.selection.startBar}–${props.selection.endBar}`,
)
</script>

<template>
  <div
    class="actions"
    role="toolbar"
    :aria-label="`Selection: ${range}`"
    data-testid="selection-actions"
  >
    <span class="range" data-testid="selection-range">{{ range }}</span>
    <span class="count">{{ bars }} {{ bars === 1 ? 'bar' : 'bars' }}</span>
    <button type="button" class="primary" data-testid="selection-loop" @click="emit('loop')">
      <AppIcon name="loop" :size="16" />Loop these bars
    </button>
    <button
      type="button"
      class="outline"
      :title="saveKey === '' ? undefined : `Save as bookmark (${saveKey})`"
      data-testid="selection-save"
      @click="emit('save')"
    >
      <AppIcon name="bookmark" :size="14" class="mark" />Save as bookmark
    </button>
    <button
      type="button"
      class="clear"
      aria-label="Clear selection"
      title="Clear selection (Esc)"
      data-testid="selection-clear"
      @click="emit('clear')"
    >
      <AppIcon name="close" :size="16" />
    </button>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 12px;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 12px;
  background: rgb(18 24 44 / 88%);
  box-shadow: 0 10px 30px rgb(0 0 0 / 50%);
  white-space: nowrap;
}

.range {
  color: var(--text-1);
  font-size: var(--text-sm);
}

.count {
  color: var(--text-4);
  font-size: var(--text-xs);
}

button {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 9px;
  font-size: var(--text-sm);
  cursor: pointer;
}

.primary {
  border: 0;
  background: var(--primary);
  color: var(--on-primary);
  font-weight: var(--weight-semibold);
}

.outline {
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-1);
}

.outline:hover {
  background: var(--field-hover);
}

.mark {
  color: var(--secondary);
}

.clear {
  width: 32px;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-3);
}

.clear:hover {
  color: var(--text-1);
}

button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
