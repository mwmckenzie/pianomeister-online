<script setup lang="ts">
import { computed } from 'vue'

/**
 * A bar range inside a song (bars `start`–`end` of `total`), drawn in the secondary colour
 * (decision 52). Used for "Full song" now and bookmarks in milestone 7.
 */
const props = defineProps<{
  readonly start: number
  readonly end: number
  readonly total: number
}>()

const style = computed(() => {
  const total = Math.max(1, props.total)
  const from = Math.max(0, Math.min(1, (props.start - 1) / total))
  const to = Math.max(from, Math.min(1, props.end / total))
  return { left: `${from * 100}%`, width: `${(to - from) * 100}%` }
})
</script>

<template>
  <span class="range-bar" role="img" :aria-label="`Bars ${start}–${end} of ${total}`">
    <span class="fill" :style="style" />
  </span>
</template>

<style scoped>
.range-bar {
  position: relative;
  display: block;
  height: 5px;
  border-radius: 3px;
  background: rgb(255 255 255 / 10%);
}

.fill {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 6px;
  border-radius: inherit;
  background: var(--secondary);
}
</style>
