<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

import AppIcon from './AppIcon.vue'

/**
 * Circular-arrow reset for one setting (decision 51): dim at the default, primary when changed,
 * always the same size so the row never shifts. The tooltip shows on hover and keyboard focus.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ readonly changed: boolean; readonly settingLabel: string }>()
defineEmits<{ reset: [] }>()
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <button
        type="button"
        class="reset"
        :class="{ changed }"
        :aria-label="`Reset ${settingLabel} to default`"
        :data-changed="changed"
        v-bind="$attrs"
        @click="$emit('reset')"
      >
        <AppIcon name="reset" :size="18" />
      </button>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="tooltip pm-fade" :side-offset="4">Reset to default</TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<style scoped>
.reset {
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-4);
  opacity: 0.45;
  cursor: pointer;
  transition:
    color var(--dur-fast),
    opacity var(--dur-fast),
    background var(--dur-fast);
}

.reset:hover,
.reset:focus-visible {
  opacity: 1;
  background: var(--field);
}

.changed {
  color: var(--primary);
  opacity: 1;
}
</style>
