<script setup lang="ts">
const model = defineModel<number>({ required: true })

withDefaults(
  defineProps<{
    readonly label: string
    readonly range: readonly [number, number]
    readonly step: number
    /** Formats the value shown next to the label. */
    readonly format?: (value: number) => string
    readonly testid?: string
  }>(),
  { format: (value: number) => String(value), testid: undefined },
)
</script>

<template>
  <label>
    {{ label }} <output>{{ format(model) }}</output>
    <input
      v-model.number="model"
      type="range"
      :min="range[0]"
      :max="range[1]"
      :step="step"
      :data-testid="testid"
    />
  </label>
</template>

<style scoped>
label {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.15rem 0.5rem;
  margin: 0.35rem 0;
}

input {
  grid-column: 1 / -1;
}

output {
  color: #c8d4f0;
  font-variant-numeric: tabular-nums;
}
</style>
