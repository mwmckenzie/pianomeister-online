<script setup lang="ts">
import {
  AutocompleteAnchor,
  AutocompleteContent,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteLabel,
  AutocompletePortal,
  AutocompleteRoot,
  AutocompleteTrigger,
  AutocompleteViewport,
} from 'reka-ui'
import { computed, ref } from 'vue'

import { type ComposerCount, composerSuggestions } from '@/core/library/composerSuggestions'

import AppIcon from './AppIcon.vue'

/**
 * Free text with suggestions (Reka Autocomplete), for the composer (decision 58): typing shows
 * names containing the text, the button lists everyone with song counts, and "Add ‘…’ as a new
 * composer" appears when nothing matches exactly. The text is the v-model; `commit` fires when
 * a value is chosen, on Enter, or on leaving the field.
 */
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  readonly options: readonly ComposerCount[]
  readonly label: string
  readonly allLabel?: string
}>()
const emit = defineEmits<{ commit: [value: string] }>()
const text = defineModel<string>({ required: true })

const open = ref(false)
/** Opened from the button: list everyone, whatever is typed. */
const showAll = ref(false)
const highlighted = ref<string | undefined>(undefined)

const suggestions = computed(() => composerSuggestions(props.options, text.value))
const items = computed(() => (showAll.value ? props.options : suggestions.value.matches))
const newName = computed(() =>
  showAll.value || suggestions.value.exactMatch ? '' : text.value.trim(),
)
const NEW_PREFIX = '\u0000new:'

function onOpen(value: boolean): void {
  open.value = value
  if (!value) showAll.value = false
}

function onTyped(value: string): void {
  showAll.value = false
  // Choosing the "Add" item also writes its value here; keep just the name.
  text.value = value.startsWith(NEW_PREFIX) ? value.slice(NEW_PREFIX.length) : value
}

function choose(value: string): void {
  const name = value.startsWith(NEW_PREFIX) ? value.slice(NEW_PREFIX.length) : value
  text.value = name
  open.value = false
  emit('commit', name)
}

function onEnter(): void {
  // With an item highlighted, Reka selects it (and choose() commits); otherwise the typed text.
  if (highlighted.value === undefined) {
    open.value = false
    emit('commit', text.value)
  }
}

function showEveryone(): void {
  // Reka opens the list before this click handler runs; closing resets it in onOpen.
  showAll.value = true
}
</script>

<template>
  <AutocompleteRoot
    :model-value="text"
    :open="open"
    ignore-filter
    :reset-search-term-on-blur="false"
    highlight-on-hover
    @update:model-value="onTyped"
    @update:open="onOpen"
    @highlight="highlighted = $event?.value"
  >
    <AutocompleteAnchor class="combo-anchor">
      <AutocompleteInput
        class="combo-input"
        :aria-label="label"
        v-bind="$attrs"
        @keydown.enter="onEnter"
        @blur="emit('commit', text)"
      />
      <AutocompleteTrigger
        class="combo-trigger"
        aria-label="Show all composers"
        @click="showEveryone"
      >
        <AppIcon :name="open ? 'chevronUp' : 'chevronDown'" :size="18" />
      </AutocompleteTrigger>
    </AutocompleteAnchor>
    <AutocompletePortal>
      <AutocompleteContent
        class="combo-content glass pm-animated"
        position="popper"
        :side-offset="8"
        :collision-padding="12"
      >
        <AutocompleteViewport class="combo-viewport">
          <AutocompleteGroup>
            <AutocompleteLabel
              v-if="showAll || text.trim() === ''"
              class="section-caps combo-label"
            >
              {{ allLabel ?? 'All' }}
            </AutocompleteLabel>
            <AutocompleteItem
              v-for="item in items"
              :key="item.name"
              :value="item.name"
              class="combo-item"
              @select="choose(item.name)"
            >
              <span class="name" :title="item.name">{{ item.name }}</span>
              <span class="count">{{ item.count }} {{ item.count === 1 ? 'song' : 'songs' }}</span>
            </AutocompleteItem>
            <AutocompleteItem
              v-if="newName !== ''"
              :value="`${NEW_PREFIX}${newName}`"
              class="combo-item new"
              data-testid="combo-add-new"
              @select="choose(`${NEW_PREFIX}${newName}`)"
            >
              Add ‘{{ newName }}’ as a new composer
            </AutocompleteItem>
          </AutocompleteGroup>
        </AutocompleteViewport>
      </AutocompleteContent>
    </AutocompletePortal>
  </AutocompleteRoot>
</template>

<style>
.combo-anchor {
  display: flex;
  align-items: center;
  min-height: 38px;
  border: 1px solid var(--border-field);
  border-radius: 10px;
  background: rgb(255 255 255 / 5%);
}

.combo-anchor:focus-within {
  border-color: var(--primary);
}

.combo-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--text-strong);
  font-size: var(--text-base);
  outline: none;
}

.combo-input:focus-visible {
  box-shadow: none;
}

.combo-trigger {
  display: grid;
  place-items: center;
  align-self: stretch;
  width: 36px;
  border: 0;
  border-left: 1px solid rgb(255 255 255 / 10%);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}

.combo-content {
  z-index: 70;
  width: var(--reka-combobox-trigger-width);
  max-height: min(340px, var(--reka-combobox-content-available-height));
  overflow: hidden;
  border-radius: var(--radius-md);
  --glass-alpha: 0.95;
}

.combo-viewport {
  padding: var(--space-2);
}

.combo-label {
  padding: var(--space-2) var(--space-3);
}

.combo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 36px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: var(--text-md);
  cursor: pointer;
  outline: none;
}

.combo-item[data-highlighted] {
  background: var(--selection);
}

.combo-item .name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.combo-item .count {
  flex-shrink: 0;
  color: var(--text-4);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.combo-item.new {
  color: var(--primary);
}
</style>
