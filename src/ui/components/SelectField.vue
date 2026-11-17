<script setup lang="ts" generic="V extends string">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

import AppIcon from './AppIcon.vue'

/** A drop-down select (Reka Select) in the glass style. */
defineOptions({ inheritAttrs: false })
defineProps<{
  readonly modelValue: V
  readonly options: readonly { readonly value: V; readonly label: string }[]
  readonly label: string
  readonly disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: V] }>()

function update(value: unknown): void {
  if (typeof value === 'string') emit('update:modelValue', value as V)
}
</script>

<template>
  <SelectRoot :model-value="modelValue" :disabled="disabled" @update:model-value="update">
    <SelectTrigger class="select-trigger" :aria-label="label" v-bind="$attrs">
      <SelectValue />
      <AppIcon name="chevronDown" :size="18" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        class="select-content glass pm-animated"
        position="popper"
        :side-offset="6"
        :collision-padding="12"
      >
        <SelectViewport class="select-viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            class="select-item"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="select-check">
              <AppIcon name="check" :size="16" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style>
.select-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 120px;
  min-height: 38px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--border-field);
  border-radius: 10px;
  background: var(--field);
  color: var(--text-strong);
  font-size: var(--text-md);
  cursor: pointer;
}

/* Inline in a row (hand channels): the reference's 34 px select. */
.select-trigger.compact {
  min-width: 100px;
  min-height: 34px;
  padding: 0 8px 0 10px;
  border-radius: 9px;
  font-size: var(--text-sm);
}

.select-trigger:hover {
  background: var(--field-hover);
}

.select-content {
  z-index: 70;
  min-width: var(--reka-select-trigger-width);
  max-height: var(--reka-select-content-available-height);
  border-radius: var(--radius-md);
  --glass-alpha: 0.94;
}

.select-viewport {
  padding: var(--space-1);
}

.select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 38px;
  padding: 0 var(--space-3);
  border-radius: 8px;
  color: var(--text-1);
  font-size: var(--text-sm);
  outline: none;
  cursor: pointer;
  user-select: none;
}

.select-item[data-highlighted] {
  background: var(--selection);
}

.select-check {
  color: var(--primary);
}
</style>
