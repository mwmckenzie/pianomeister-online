<script setup lang="ts">
import { computed } from 'vue'

/**
 * Practice minutes per day, oldest first and today last (brief decision 71). Bars share the
 * width; empty days are a faint stub, today is in the primary colour and the rest in the
 * secondary (decision 52). No axis: the numbers are in the label for screen readers.
 */
const props = withDefaults(
  defineProps<{
    readonly minutes: readonly number[]
    readonly height?: number
    readonly gap?: number
    readonly label: string
  }>(),
  { height: 34, gap: 3 },
)

const bars = computed(() => {
  const max = Math.max(...props.minutes, 0)
  const last = props.minutes.length - 1
  return props.minutes.map((m, i) => ({
    height: max > 0 ? Math.max(4, (m / max) * 100) : 4,
    kind: m <= 0 ? 'empty' : i === last ? 'today' : 'day',
  }))
})

const description = computed(() => {
  const total = props.minutes.reduce((a, b) => a + b, 0)
  const days = props.minutes.filter((m) => m > 0).length
  return `${props.label}: ${Math.round(total)} minutes over the last ${props.minutes.length} days, practised on ${days} ${days === 1 ? 'day' : 'days'}`
})
</script>

<template>
  <div
    class="practice-chart"
    role="img"
    :aria-label="description"
    :style="{ height: `${height}px`, gap: `${gap}px` }"
  >
    <span
      v-for="(bar, i) in bars"
      :key="i"
      class="bar"
      :class="bar.kind"
      :style="{ height: `${bar.height}%` }"
    />
  </div>
</template>

<style scoped>
.practice-chart {
  display: flex;
  align-items: flex-end;
}

.bar {
  flex: 1;
  border-radius: 2px;
}

.empty {
  background: rgb(255 255 255 / 8%);
}

.day {
  background: rgb(var(--secondary-rgb) / 60%);
}

.today {
  background: var(--primary);
}
</style>
