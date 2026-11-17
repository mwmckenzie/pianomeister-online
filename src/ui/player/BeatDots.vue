<script setup lang="ts">
import { computed } from 'vue'

import { beatGroups } from '@/core/timing/beatGroups'

/**
 * One dot per beat of the current bar, stacked upward like the highway: beat 1 at the bottom.
 * The current beat is lit in the primary colour, beats already played in this bar faintly; it
 * resets on each downbeat. Long bars split into columns by pulse (6/8 → two columns of three)
 * so the stack stays about as tall as the bar counter.
 */
const props = defineProps<{ readonly beats: number; readonly beat: number }>()

const columns = computed(() => {
  let first = 1
  return beatGroups(Math.min(props.beats, 16)).map((size) => {
    const column = Array.from({ length: size }, (_, i) => first + i)
    first += size
    return column
  })
})
</script>

<template>
  <span class="beat-dots" :aria-label="`Beat ${beat} of ${beats}`" data-testid="beat-dots">
    <span v-for="(column, i) in columns" :key="i" class="column">
      <span
        v-for="n in column"
        :key="n"
        class="dot"
        :class="{ current: n === beat, played: n < beat }"
        :data-beat="n"
      />
    </span>
  </span>
</template>

<style scoped>
.beat-dots {
  display: flex;
  align-self: center;
  gap: 7px;
  padding-top: 4px;
}

/* Beat 1 at the bottom, filling upward. */
.column {
  display: flex;
  flex-direction: column-reverse;
  gap: 5px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgb(232 236 246 / 18%);
}

.dot.played {
  background: rgb(var(--primary-rgb) / 35%);
}

.dot.current {
  background: var(--primary);
  box-shadow: 0 0 8px var(--primary);
}
</style>
