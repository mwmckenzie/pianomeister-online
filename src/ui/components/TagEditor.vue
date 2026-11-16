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
      <button type="button" :aria-label="`Remove tag ${tag}`" @click="remove(tag)">✕</button>
    </span>
    <input
      v-model="draft"
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
  gap: 0.3rem;
  align-items: center;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.25rem 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgb(92 111 153 / 35%);
}

.tag button {
  padding: 0 0.25rem;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

input {
  flex: 1 1 6rem;
  min-width: 6rem;
}
</style>
