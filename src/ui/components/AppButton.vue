<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import type { IconName } from './IconName'

/** Text button: primary (filled), outline, or text (link-like). */
withDefaults(
  defineProps<{
    readonly variant?: 'primary' | 'outline' | 'text'
    readonly icon?: IconName
    readonly size?: 'sm' | 'md'
    readonly type?: 'button' | 'submit'
    readonly disabled?: boolean
    readonly danger?: boolean
  }>(),
  { variant: 'outline', size: 'md', type: 'button', disabled: false, danger: false },
)
</script>

<template>
  <button :type="type" class="btn" :class="[variant, size, { danger }]" :disabled="disabled">
    <AppIcon v-if="icon" :name="icon" :size="size === 'sm' ? 16 : 18" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: var(--weight-regular);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--dur-fast),
    border-color var(--dur-fast),
    color var(--dur-fast),
    filter var(--dur-fast);
}

.md {
  min-height: 44px;
  padding: 0 18px;
  font-size: var(--text-md);
}

.sm {
  min-height: 36px;
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
}

.primary {
  background: var(--primary);
  color: var(--on-primary);
  font-weight: var(--weight-semibold);
}

.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}

.outline {
  border-color: var(--border-strong);
  background: transparent;
  color: var(--text-1);
}

.outline:hover:not(:disabled) {
  background: var(--field-hover);
}

.text {
  min-height: 32px;
  padding: 0 var(--space-1);
  background: transparent;
  color: var(--text-3);
  font-size: var(--text-sm);
}

.text:hover:not(:disabled) {
  color: var(--text-1);
}

.danger.outline {
  border-color: rgb(255 138 138 / 35%);
  color: var(--danger);
}

.btn:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
