<script setup lang="ts">
/** A frosted-glass surface (decision 53); `as` picks the element (aside, section, div…). */
withDefaults(defineProps<{ readonly as?: string; readonly radius?: 'md' | 'lg' | 'none' }>(), {
  as: 'div',
  radius: 'lg',
})
</script>

<template>
  <component :is="as" class="glass glass-panel" :class="`radius-${radius}`">
    <slot />
  </component>
</template>

<style scoped>
.glass-panel {
  color: var(--text-1);
}

.radius-lg {
  border-radius: var(--radius-lg);
}

.radius-md {
  border-radius: var(--radius-md);
}

.radius-none {
  border-radius: 0;
}
</style>
