<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

import AppIcon from './AppIcon.vue'
import type { IconName } from './IconName'

/** A round icon-only button with a tooltip naming it (the tooltip text is its label). */
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    readonly icon: IconName
    readonly label: string
    readonly size?: 'sm' | 'md' | 'lg'
    /** Highlighted (e.g. loop on, panel open). */
    readonly active?: boolean
    readonly disabled?: boolean
    readonly variant?: 'ghost' | 'filled' | 'outline'
  }>(),
  { size: 'md', active: false, disabled: false, variant: 'ghost' },
)
defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <button
        type="button"
        class="icon-button"
        :class="[size, variant, { active }]"
        :aria-label="label"
        :aria-pressed="active ? 'true' : undefined"
        :disabled="disabled"
        v-bind="$attrs"
        @click="$emit('click', $event)"
      >
        <AppIcon :name="icon" :size="size === 'lg' ? 30 : size === 'sm' ? 18 : 22" />
      </button>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="tooltip pm-fade" :side-offset="6">{{ label }}</TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<style scoped>
.icon-button {
  display: inline-grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition:
    background var(--dur-fast),
    color var(--dur-fast),
    border-color var(--dur-fast);
}

.icon-button:hover:not(:disabled) {
  background: var(--field-hover);
  color: var(--text-1);
}

.icon-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.sm {
  width: 32px;
  height: 32px;
}

.md {
  width: 44px;
  height: 44px;
}

.lg {
  width: 60px;
  height: 60px;
}

.filled {
  background: var(--field);
}

.outline {
  border-color: var(--text-2);
  color: var(--text-1);
}

.active {
  background: rgb(var(--primary-rgb) / 18%);
  color: var(--primary);
}
</style>

<style>
.tooltip {
  z-index: 60;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-pop);
  color: var(--text-1);
  font-size: var(--text-xs);
  user-select: none;
}
</style>
