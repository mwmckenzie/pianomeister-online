<script setup lang="ts" generic="V extends string">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

/** One-of-several buttons (Reka ToggleGroup). Clicking the active option keeps it selected. */
const props = defineProps<{
  readonly modelValue: V
  readonly options: readonly { readonly value: V; readonly label: string }[]
  /** Accessible name of the group. */
  readonly label: string
  /** Greyed out and not clickable (e.g. a setting with no effect right now). */
  readonly disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: V] }>()

function update(value: unknown): void {
  if (typeof value === 'string' && value !== '' && value !== props.modelValue) {
    emit('update:modelValue', value as V)
  }
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    class="segmented"
    data-owns-arrows
    :model-value="modelValue"
    :aria-label="label"
    :disabled="disabled"
    :class="{ off: disabled }"
    @update:model-value="update"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="segment"
      :data-value="option.value"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--field);
}

.segment {
  min-height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-2);
  font-size: var(--text-sm);
  cursor: pointer;
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}

.segment:hover {
  color: var(--text-1);
}

.segment[data-state='on'] {
  background: rgb(var(--primary-rgb) / 20%);
  color: var(--text-1);
  font-weight: var(--weight-medium);
}
.segmented.off {
  opacity: 0.45;
}

.segmented.off .segment {
  cursor: default;
}
</style>
