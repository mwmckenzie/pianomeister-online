<script setup lang="ts">
import { useTemplateRef } from 'vue'

import AppIcon from './AppIcon.vue'

/**
 * The search box of the picker and library (m6 reference: 40 px, field background, no border at
 * rest, a 1 px primary ring on focus). Attributes such as data-testid go to the input.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ readonly label: string; readonly placeholder?: string }>()
const model = defineModel<string>({ required: true })
const input = useTemplateRef<HTMLInputElement>('input')

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <label class="search-field">
    <AppIcon name="search" :size="16" />
    <span class="visually-hidden">{{ label }}</span>
    <input
      ref="input"
      v-model="model"
      type="search"
      :placeholder="placeholder ?? 'Search title, composer or tag'"
      v-bind="$attrs"
    />
  </label>
</template>

<style scoped>
.search-field {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
  height: 40px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  background: var(--field);
  color: var(--text-3);
  font-size: var(--text-md);
}

.search-field:focus-within {
  box-shadow: var(--focus-ring-field);
}

input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-strong);
  font-size: var(--text-md);
  outline: none;
}

input:focus-visible {
  box-shadow: none;
}

input::placeholder {
  color: var(--text-3);
}
</style>
