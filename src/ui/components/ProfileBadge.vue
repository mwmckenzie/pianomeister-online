<script setup lang="ts">
import { computed } from 'vue'

import { profileInitial } from '@/core/profiles/profileInitial'

/** A profile's initial in a small circle of its colour (brief decision 66). */
const props = withDefaults(
  defineProps<{ readonly name: string; readonly color: string; readonly size?: number }>(),
  { size: 22 },
)
const initial = computed(() => profileInitial(props.name))
</script>

<template>
  <span
    class="profile-badge"
    :style="{ '--badge-color': color, '--badge-size': `${size}px` }"
    aria-hidden="true"
    >{{ initial }}</span
  >
</template>

<style scoped>
.profile-badge {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--badge-size);
  height: var(--badge-size);
  border-radius: 50%;
  background: var(--badge-color);
  color: #0b1020;
  font-size: calc(var(--badge-size) * 0.5);
  font-weight: 600;
  line-height: 1;
}
</style>
