<script setup lang="ts">
/** An on/off checkbox, styled to the tokens (native input, so it's announced as a checkbox). */
defineProps<{
  readonly modelValue: boolean
  readonly label: string
  readonly id?: string
  readonly disabled?: boolean
}>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <input
    :id="id"
    type="checkbox"
    class="toggle"
    :checked="modelValue"
    :disabled="disabled"
    :aria-label="label"
    @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
  />
</template>

<style scoped>
.toggle {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin: 0;
  border: 1.5px solid var(--border-strong);
  border-radius: 6px;
  background: var(--field);
  appearance: none;
  cursor: pointer;
  transition:
    background var(--dur-fast),
    border-color var(--dur-fast);
}

.toggle:disabled {
  cursor: default;
  opacity: 0.45;
}

.toggle::after {
  width: 12px;
  height: 7px;
  margin-top: -3px;
  border-bottom: 2.5px solid var(--on-primary);
  border-left: 2.5px solid var(--on-primary);
  content: '';
  opacity: 0;
  transform: rotate(-45deg);
}

.toggle:checked {
  border-color: var(--primary);
  background: var(--primary);
}

.toggle:checked::after {
  opacity: 1;
}
</style>
