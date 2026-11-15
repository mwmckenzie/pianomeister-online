<script setup lang="ts">
import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'
</script>

<template>
  <main class="home">
    <h1>PianoMeister Online</h1>
    <ul class="swatches" aria-label="Pitch class colors">
      <li v-for="color in PITCH_CLASS_COLORS" :key="color.name" class="swatch">
        <span class="chip" :style="{ backgroundColor: color.hex }" />
        <span class="label">{{ color.name }}</span>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 3rem 1rem;
}

h1 {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 600;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.chip {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
}

.label {
  font-size: 0.9rem;
}
</style>
