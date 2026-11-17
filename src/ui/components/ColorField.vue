<script setup lang="ts">
import { ref, watch } from 'vue'

/** A colour picker plus its hex value; the hex applies on Enter or blur when it's valid. */
const props = defineProps<{ readonly modelValue: string; readonly label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const HEX = /^#?[0-9a-f]{6}$/i
const text = ref(props.modelValue)
watch(
  () => props.modelValue,
  (value) => (text.value = value),
)

function commit(): void {
  const value = text.value.trim()
  if (!HEX.test(value)) {
    text.value = props.modelValue
    return
  }
  const hex = (value.startsWith('#') ? value : `#${value}`).toUpperCase()
  text.value = hex
  if (hex !== props.modelValue.toUpperCase()) emit('update:modelValue', hex)
}

function picked(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value.toUpperCase())
}
</script>

<template>
  <span class="color-field">
    <input
      type="color"
      class="swatch"
      :value="modelValue.toLowerCase()"
      :aria-label="`${label} colour`"
      @input="picked"
    />
    <input
      v-model="text"
      class="hex"
      type="text"
      spellcheck="false"
      maxlength="7"
      :aria-label="`${label} hex value`"
      @keydown.enter="commit"
      @blur="commit"
    />
  </span>
</template>

<style scoped>
.color-field {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.swatch {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: none;
  cursor: pointer;
}

.swatch::-webkit-color-swatch-wrapper {
  padding: 3px;
}

.swatch::-webkit-color-swatch {
  border: 0;
  border-radius: 7px;
}

.hex {
  width: 6.5em;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--field);
  font-size: var(--text-sm);
  text-transform: uppercase;
}
</style>
