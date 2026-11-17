<script setup lang="ts">
import { computed } from 'vue'

import { ICONS } from './ICONS'
import type { IconName } from './IconName'

const props = withDefaults(defineProps<{ readonly name: IconName; readonly size?: number }>(), {
  size: 22,
})

const icon = computed<{ readonly d?: string; readonly fill?: string }>(() => ICONS[props.name])
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-if="icon.d"
      :d="icon.d"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path v-if="icon.fill" :d="icon.fill" fill="currentColor" />
  </svg>
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>
