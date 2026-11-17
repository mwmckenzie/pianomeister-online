<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

/**
 * A small glass panel anchored to its trigger (Reka Popover); Esc or a click outside closes it
 * and returns focus to the trigger.
 */
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    readonly side?: 'top' | 'bottom' | 'left' | 'right'
    readonly align?: 'start' | 'center' | 'end'
    readonly label: string
  }>(),
  { side: 'top', align: 'center' },
)
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="popover glass pm-animated"
        :side="side"
        :align="align"
        :side-offset="10"
        :collision-padding="16"
        :aria-label="label"
        v-bind="$attrs"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
.popover {
  z-index: 50;
  width: 320px;
  max-width: calc(100vw - 32px);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  --glass-alpha: 0.86;
}
</style>
