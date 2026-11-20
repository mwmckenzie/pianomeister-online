<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { Highlight } from '@/core/insights/Highlight'

/**
 * Welcome's rotating highlight (QGWelcomeA, m7-7 decision 9): one at a time, cross-fading every
 * 8 s, paused while hovered or focused; the dots show the position and select one. The change
 * is a fade only, so reduced motion keeps it as it is (nothing moves).
 */
const props = defineProps<{ readonly highlights: readonly Highlight[] }>()

const ROTATE_MS = 8000
const index = ref(0)
const hovered = ref(false)
const focused = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const current = computed(() => props.highlights[index.value] ?? props.highlights[0] ?? null)

watch(
  () => props.highlights.length,
  (n) => {
    if (index.value >= n) index.value = 0
  },
)

onMounted(() => {
  timer = setInterval(() => {
    if (hovered.value || focused.value || props.highlights.length < 2) return
    index.value = (index.value + 1) % props.highlights.length
  }, ROTATE_MS)
})
onBeforeUnmount(() => clearInterval(timer))

/** The trend line: points across 120 × 40, the last one marked. */
const trend = computed(() => {
  const values = current.value?.trend ?? []
  if (values.length < 2) return null
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const points = values.map((v, i) => ({
    x: 4 + (i / (values.length - 1)) * 112,
    y: 34 - (hi === lo ? 12 : ((v - lo) / (hi - lo)) * 24),
  }))
  return {
    d: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    end: points[points.length - 1],
  }
})
</script>

<template>
  <section
    v-if="current"
    class="highlight"
    aria-roledescription="carousel"
    aria-label="Highlights"
    data-testid="highlight"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
    @focusin="focused = true"
    @focusout="focused = false"
  >
    <svg v-if="trend" width="120" height="40" viewBox="0 0 120 40" aria-hidden="true">
      <path :d="trend.d" class="trend" />
      <circle v-if="trend.end" :cx="trend.end.x" :cy="trend.end.y" r="4" class="trend-end" />
    </svg>
    <Transition name="fade" mode="out-in">
      <div :key="index" class="text" aria-live="polite">
        <p class="section-caps cap">Highlight</p>
        <p class="title" data-testid="highlight-title">
          <span v-for="(part, i) in current.title" :key="i" :class="{ accent: part.accent }">{{
            part.text
          }}</span>
        </p>
        <p class="detail">{{ current.detail }}</p>
      </div>
    </Transition>
    <div v-if="highlights.length > 1" class="dots" role="group" aria-label="Choose a highlight">
      <button
        v-for="(h, i) in highlights"
        :key="i"
        type="button"
        class="dot"
        :class="{ active: i === index }"
        :aria-label="`Highlight ${i + 1} of ${highlights.length}`"
        :aria-current="i === index ? 'true' : undefined"
        data-testid="highlight-dot"
        @click="index = i"
      />
    </div>
  </section>
</template>

<style scoped>
.highlight {
  display: flex;
  align-items: center;
  gap: 18px;
  text-shadow: 0 1px 10px rgb(0 0 0 / 85%);
}

.trend {
  fill: none;
  stroke: var(--secondary);
  stroke-width: 2px;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.trend-end {
  fill: var(--secondary);
  stroke: rgb(11 16 32);
  stroke-width: 2px;
}

.text {
  min-width: 0;
}

p {
  margin: 0;
}

.cap {
  color: var(--secondary);
}

.title {
  margin-top: 2px;
  font-size: 18px;
}

.accent {
  color: var(--secondary);
}

.detail {
  margin-top: 2px;
  color: var(--text-2);
  font-size: 13px;
}

.dots {
  display: flex;
  gap: 6px;
  margin-left: 16px;
}

.dot {
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgb(232 236 246 / 30%);
  cursor: pointer;
  transition:
    width var(--dur-fast),
    background var(--dur-fast);
}

.dot.active {
  width: 18px;
  background: var(--secondary);
}

.dot:focus-visible {
  outline: 2px solid var(--text-strong);
  outline-offset: 2px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 400ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
