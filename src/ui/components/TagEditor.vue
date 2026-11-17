<script setup lang="ts">
import { ref, useId } from 'vue'

import { normalizeTags } from '@/core/library/normalizeTags'

const props = defineProps<{
  readonly modelValue: readonly string[]
  /** Existing tags offered as autocomplete. */
  readonly suggestions: readonly string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [tags: string[]] }>()

const listId = useId()
const draft = ref('')

function commit(): void {
  const parts = draft.value.split(',')
  draft.value = ''
  const tags = normalizeTags([...props.modelValue, ...parts])
  if (tags.length !== props.modelValue.length) emit('update:modelValue', tags)
}

function remove(tag: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== tag),
  )
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Backspace' && draft.value === '' && props.modelValue.length > 0) {
    remove(props.modelValue[props.modelValue.length - 1] as string)
  }
}
</script>

<template>
  <div class="tags">
    <span v-for="tag in modelValue" :key="tag" class="tag">
      {{ tag }}
      <button type="button" :aria-label="`Remove tag ${tag}`" @click="remove(tag)">×</button>
    </span>
    <input
      v-model="draft"
      class="form-control"
      :list="listId"
      data-testid="tag-input"
      aria-label="Add tag"
      placeholder="Add tag…"
      @keydown="onKeyDown"
      @change="commit"
      @blur="commit"
    />
    <datalist :id="listId">
      <option
        v-for="s in suggestions.filter(
          (s) => !modelValue.some((t) => t.toLowerCase() === s.toLowerCase()),
        )"
        :key="s"
        :value="s"
      />
    </datalist>
  </div>
</template>

<style scoped>
.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  padding: 0 2px 0 10px;
  border: 0;
  border-radius: var(--radius-full);
  background: rgb(255 255 255 / 8%);
  color: var(--text-soft);
  font-size: var(--text-sm);
}

.tag button {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--text-3);
  font-size: 16px;
  cursor: pointer;
}

.tag button:hover {
  background: var(--field-hover);
  color: var(--text-1);
}

input {
  flex: 1 1 8rem;
  min-width: 8rem;
}
</style>
