<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { SETTING_RANGES } from '@/core/settings/SETTING_RANGES'

import { useSettingsStore } from '../stores/settingsStore'

const emit = defineEmits<{ close: [] }>()
const store = useSettingsStore()
const { settings } = storeToRefs(store)
const R = SETTING_RANGES

const lineColors = [
  { key: 'lane', label: 'Lane lines' },
  { key: 'bar', label: 'Bar lines' },
  { key: 'beat', label: 'Beat lines' },
  { key: 'pedal', label: 'Pedal band' },
] as const
</script>

<template>
  <aside class="panel" aria-label="Settings">
    <header>
      <h2>Settings</h2>
      <button type="button" aria-label="Close settings" @click="emit('close')">✕</button>
    </header>

    <fieldset>
      <legend>Camera</legend>
      <label>
        Tilt <output>{{ settings.camera.tiltDeg }}°</output>
        <input
          v-model.number="settings.camera.tiltDeg"
          data-testid="setting-tilt"
          type="range"
          :min="R.camera.tiltDeg[0]"
          :max="R.camera.tiltDeg[1]"
          step="1"
        />
      </label>
      <label>
        Distance <output>{{ settings.camera.distanceOffset.toFixed(2) }}</output>
        <input
          v-model.number="settings.camera.distanceOffset"
          type="range"
          :min="R.camera.distanceOffset[0]"
          :max="R.camera.distanceOffset[1]"
          step="0.05"
        />
      </label>
      <label>
        Pan <output>{{ settings.camera.pan.toFixed(1) }}</output>
        <input
          v-model.number="settings.camera.pan"
          type="range"
          :min="R.camera.pan[0]"
          :max="R.camera.pan[1]"
          step="0.5"
        />
      </label>
    </fieldset>

    <fieldset>
      <legend>Highway &amp; keys</legend>
      <label>
        Look-ahead <output>{{ settings.highway.lookAheadBeats }} beats</output>
        <input
          v-model.number="settings.highway.lookAheadBeats"
          type="range"
          :min="R.highway.lookAheadBeats[0]"
          :max="R.highway.lookAheadBeats[1]"
          step="1"
        />
      </label>
      <label>
        Key fade-in <output>{{ settings.keys.fadeBeats }} beats</output>
        <input
          v-model.number="settings.keys.fadeBeats"
          type="range"
          :min="R.keys.fadeBeats[0]"
          :max="R.keys.fadeBeats[1]"
          step="0.25"
        />
      </label>
      <label>
        Max approach <output>{{ Math.round(settings.keys.maxApproachAlpha * 100) }}%</output>
        <input
          v-model.number="settings.keys.maxApproachAlpha"
          type="range"
          min="0"
          max="1"
          step="0.05"
        />
      </label>
    </fieldset>

    <fieldset>
      <legend>Sustain transparency</legend>
      <label>
        Lane centre
        <output>{{ Math.round(settings.notes.sustainCenterTransparency * 100) }}%</output>
        <input
          v-model.number="settings.notes.sustainCenterTransparency"
          type="range"
          min="0"
          max="1"
          step="0.05"
        />
      </label>
      <label>
        Lane edges <output>{{ Math.round(settings.notes.sustainEdgeTransparency * 100) }}%</output>
        <input
          v-model.number="settings.notes.sustainEdgeTransparency"
          type="range"
          min="0"
          max="1"
          step="0.05"
        />
      </label>
    </fieldset>

    <fieldset>
      <legend>Colours</legend>
      <label class="color">
        Background <input v-model="settings.colors.background" type="color" />
      </label>
      <label class="color">
        Highway <input v-model="settings.colors.highway" type="color" />
      </label>
      <div v-for="line in lineColors" :key="line.key" class="color-row">
        <label class="color">
          {{ line.label }} <input v-model="settings.colors[line.key]" type="color" />
        </label>
        <input
          v-model.number="settings.opacity[line.key]"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :aria-label="`${line.label} opacity`"
        />
        <output>{{ Math.round(settings.opacity[line.key] * 100) }}%</output>
      </div>
    </fieldset>

    <fieldset>
      <legend>Effects</legend>
      <label class="check">
        <input v-model="settings.effects.enabled" type="checkbox" /> Now-line sparks and glow
      </label>
    </fieldset>

    <button type="button" class="reset" @click="store.reset()">Reset to defaults</button>
  </aside>
</template>

<style scoped>
.panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(22rem, 100vw);
  overflow-y: auto;
  padding: 0.75rem 1rem 1.5rem;
  background: rgb(10 14 28 / 94%);
  border-left: 1px solid rgb(120 140 190 / 25%);
  font-size: 0.85rem;
  z-index: 10;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

fieldset {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgb(120 140 190 / 20%);
  border-radius: 6px;
}

legend {
  color: #9fb0d8;
}

label {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.15rem 0.5rem;
  margin: 0.35rem 0;
}

label input[type='range'] {
  grid-column: 1 / -1;
}

output {
  color: #c8d4f0;
  font-variant-numeric: tabular-nums;
}

.color,
.check {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.color-row {
  display: grid;
  grid-template-columns: 9rem 1fr 2.5rem;
  align-items: center;
  gap: 0.5rem;
}

.reset {
  margin-top: 1rem;
  width: 100%;
}
</style>
