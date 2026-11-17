<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed } from 'vue'

/**
 * A single-thumb slider on Reka's accessible Slider; the value is clamped to [min, max].
 * `inverted` runs it right to left (min at the right end), and `endLabel` marks that end, as
 * the pre-roll slider does with the bar the pre-roll leads into.
 */
const props = defineProps<{
  readonly modelValue: number
  readonly min: number
  readonly max: number
  readonly step: number
  /** Accessible name of the thumb. */
  readonly label: string
  /** Spoken value, e.g. "12 mm". */
  readonly valueText?: string
  readonly disabled?: boolean
  readonly inverted?: boolean
  readonly endLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const value = computed(() => [Math.min(props.max, Math.max(props.min, props.modelValue))])

function update(next: number[] | undefined): void {
  const v = next?.[0]
  if (v !== undefined && v !== props.modelValue) emit('update:modelValue', v)
}
</script>

<template>
  <div class="slider-field" :class="{ marked: endLabel }">
    <SliderRoot
      class="slider"
      :model-value="value"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :inverted="inverted"
      @update:model-value="update"
    >
      <SliderTrack class="track">
        <SliderRange class="range" />
      </SliderTrack>
      <SliderThumb class="thumb" :aria-label="label" :aria-valuetext="valueText" />
    </SliderRoot>
    <span v-if="endLabel" class="end-marker" aria-hidden="true">
      <span class="tick" />
      <span class="end-label">{{ endLabel }}</span>
    </span>
  </div>
</template>

<style scoped>
.slider-field {
  position: relative;
}

.slider-field.marked {
  padding-right: 6px;
  padding-bottom: 16px;
}

.slider {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  touch-action: none;
  user-select: none;
}

.track {
  position: relative;
  flex: 1;
  height: 6px;
  border-radius: var(--radius-full);
  background: rgb(201 210 232 / 16%);
  box-shadow: inset 0 0 0 1px rgb(201 210 232 / 10%);
}

.range {
  position: absolute;
  height: 100%;
  border-radius: inherit;
  background: rgb(var(--primary-rgb) / 85%);
}

.thumb {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 1px 4px rgb(0 0 0 / 45%);
  cursor: grab;
  transition: transform var(--dur-fast);
}

.thumb:hover {
  transform: scale(calc(1 + var(--move) * 0.1));
}

.slider[data-disabled] {
  opacity: 0.45;
}

/* The end the slider runs into: a short bar line with its label underneath. */
.end-marker {
  position: absolute;
  top: 4px;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none;
}

.tick {
  width: 2px;
  height: 20px;
  border-radius: 1px;
  background: var(--secondary);
}

.end-label {
  margin-top: 2px;
  color: var(--secondary);
  font-size: var(--text-2xs);
  white-space: nowrap;
}
</style>
