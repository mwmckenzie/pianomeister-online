<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Song } from '@/core/song/Song'
import { BarMap } from '@/core/timing/BarMap'
import type { MeterOverride } from '@/core/timing/MeterOverride'

const props = defineProps<{
  readonly song: Song
  readonly override: MeterOverride | null
}>()
const emit = defineEmits<{ save: [override: MeterOverride]; clear: [] }>()

const DENOMINATORS = [1, 2, 4, 8, 16, 32]

/** The file's own bar map: bar:beat input is read against it, before any override. */
const fileMap = computed(() => BarMap.fromSong(props.song, null))

const numerator = ref(4)
const denominator = ref(4)
const startMode = ref<'barBeat' | 'tick'>('barBeat')
const startBar = ref(1)
const startBeat = ref(1)
const startTick = ref(0)

function reset(): void {
  const o = props.override
  const firstSignature = props.song.timeSignatureEvents[0]
  numerator.value = o?.timeSignature.numerator ?? firstSignature?.numerator ?? 4
  denominator.value = o?.timeSignature.denominator ?? firstSignature?.denominator ?? 4
  setStartTick(o?.barOneStartTick ?? 0)
}

/** Shows a tick in both inputs: as the file's bar:beat when it falls on a beat, else as a tick. */
function setStartTick(tick: number): void {
  startTick.value = tick
  const at = fileMap.value.tickToPosition(tick)
  const onBeat = at.beatFraction === 0
  startBar.value = Math.max(1, at.bar)
  startBeat.value = at.beat
  startMode.value = onBeat && at.bar >= 1 ? 'barBeat' : 'tick'
}

watch(() => [props.song, props.override], reset, { immediate: true })

const resolvedTick = computed<number | null>(() => {
  if (startMode.value === 'tick') {
    return Number.isInteger(startTick.value) && startTick.value >= 0 ? startTick.value : null
  }
  const map = fileMap.value
  const bar = startBar.value
  const beat = startBeat.value
  if (!Number.isInteger(bar) || bar < 1 || bar > map.barCount + 1) return null
  if (!Number.isInteger(beat) || beat < 1 || beat > map.beatsPerBar(bar)) return null
  return map.barStartTick(bar) + (beat - 1) * map.ticksPerBeat(bar)
})

const draft = computed<MeterOverride | null>(() => {
  const n = numerator.value
  const tick = resolvedTick.value
  if (!Number.isInteger(n) || n < 1 || n > 32 || tick === null) return null
  return { timeSignature: { numerator: n, denominator: denominator.value }, barOneStartTick: tick }
})

const preview = computed(() => {
  if (draft.value === null) return null
  const map = BarMap.fromSong(props.song, draft.value)
  return { bars: map.barCount, pickup: map.hasBarZero }
})

const unchanged = computed(() => JSON.stringify(draft.value) === JSON.stringify(props.override))

function startAtFirstNote(): void {
  setStartTick(props.song.notes[0]?.startTick ?? 0)
}

function save(): void {
  if (draft.value !== null) emit('save', draft.value)
}
</script>

<template>
  <div class="meter">
    <div class="row">
      <label>
        Time signature
        <input
          v-model.number="numerator"
          class="form-control"
          data-testid="override-numerator"
          type="number"
          min="1"
          max="32"
          aria-label="Beats per bar"
        />
      </label>
      /
      <select
        v-model.number="denominator"
        class="form-control"
        aria-label="Beat unit"
        data-testid="override-denominator"
      >
        <option v-for="d in DENOMINATORS" :key="d" :value="d">{{ d }}</option>
      </select>
    </div>
    <div class="row">
      Bar 1 starts at
      <label><input v-model="startMode" type="radio" value="barBeat" /> bar:beat</label>
      <label><input v-model="startMode" type="radio" value="tick" /> tick</label>
    </div>
    <div class="row">
      <template v-if="startMode === 'barBeat'">
        <label>
          Bar
          <input
            v-model.number="startBar"
            class="form-control"
            type="number"
            min="1"
            aria-label="Start bar"
          />
        </label>
        <label>
          Beat
          <input
            v-model.number="startBeat"
            class="form-control"
            type="number"
            min="1"
            aria-label="Start beat"
          />
        </label>
        <span class="muted">(in the file's own bars)</span>
      </template>
      <label v-else>
        Tick
        <input
          v-model.number="startTick"
          class="form-control"
          type="number"
          min="0"
          step="1"
          aria-label="Start tick"
        />
      </label>
      <button type="button" class="btn-text" @click="startAtFirstNote">
        Start bar 1 at the first note
      </button>
    </div>
    <p class="muted" data-testid="override-preview">
      <template v-if="preview">
        Result: {{ preview.bars }} bars<template v-if="preview.pickup"> + bar 0 (pickup)</template>
        <template v-if="resolvedTick !== null"> · bar 1 at tick {{ resolvedTick }}</template>
      </template>
      <template v-else>Enter a valid time signature and start.</template>
    </p>
    <div class="row">
      <button
        type="button"
        class="btn-primary"
        :disabled="draft === null || unchanged"
        @click="save"
      >
        Save meter
      </button>
      <button
        type="button"
        class="btn-outline"
        :disabled="override === null"
        @click="emit('clear')"
      >
        Clear
      </button>
      <span v-if="override" class="muted">
        Override active: {{ override.timeSignature.numerator }}/{{
          override.timeSignature.denominator
        }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.meter {
  font-size: var(--text-sm);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  margin: var(--space-2) 0;
  color: var(--text-2);
}

label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

input[type='number'] {
  width: 4.5rem;
}

.muted {
  color: var(--text-3);
}

button {
  min-height: 36px;
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: var(--text-sm);
  cursor: pointer;
}

button:disabled {
  opacity: 0.45;
  cursor: default;
}

.btn-primary {
  background: var(--primary);
  color: var(--on-primary);
  font-weight: var(--weight-medium);
}

.btn-outline {
  border-color: var(--border-strong);
  background: transparent;
}

.btn-text {
  padding: 0;
  background: transparent;
  color: var(--primary);
}
</style>
