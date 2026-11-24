<script setup lang="ts">
/** A set's twelve colours as a small strip. */
defineProps<{ readonly colours: readonly string[] }>()
</script>

<template>
  <span class="strip" aria-hidden="true">
    <span v-for="(colour, pc) in colours" :key="pc" :style="{ background: colour }" />
  </span>
</template>

<style scoped>
.strip {
  display: flex;
  flex-shrink: 0;
  width: 60px;
  height: 12px;
  overflow: hidden;
  border-radius: 4px;
}

.strip > span {
  flex: 1;
}
</style>
