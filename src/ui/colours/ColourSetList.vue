<script setup lang="ts">
import { computed } from 'vue'

import type { NoteColourSetId } from '@/core/settings/NoteColourSetId'

import SelectField from '../components/SelectField.vue'
import type { ColourSetEntry } from './ColourSetEntry'
import ColourStrip from './ColourStrip.vue'

/** The sets to edit: a list, or a select where the window is narrow. */
const props = defineProps<{
  readonly builtIn: readonly ColourSetEntry[]
  readonly custom: readonly ColourSetEntry[]
  readonly compact: boolean
}>()
const emit = defineEmits<{ create: [] }>()
const selected = defineModel<NoteColourSetId>({ required: true })

const groups = computed(() => [
  { title: 'Built-in', sets: props.builtIn },
  { title: 'Your sets', sets: props.custom },
])
const label = (set: ColourSetEntry) => (set.modified ? `${set.name} · modified` : set.name)
const options = computed(() =>
  groups.value.flatMap((group) =>
    group.sets.map((set) => ({ value: set.id, label: label(set), group: group.title })),
  ),
)
</script>

<template>
  <aside class="list" :class="{ compact }" aria-label="Note colour sets">
    <SelectField
      v-if="compact"
      v-model="selected"
      :options="options"
      label="Note colour set"
      data-testid="colour-set-select"
    />
    <template v-else>
      <div v-for="group in groups" :key="group.title" class="group">
        <h4 class="section-caps title">{{ group.title }}</h4>
        <button
          v-for="set in group.sets"
          :key="set.id"
          type="button"
          class="set"
          :class="{ on: set.id === selected }"
          :aria-pressed="set.id === selected"
          :data-testid="`colour-set-${set.id}`"
          @click="selected = set.id"
        >
          <ColourStrip :colours="set.colours" />
          <span class="name">
            {{ set.name }}<span v-if="set.modified" class="modified"> · modified</span>
          </span>
        </button>
      </div>
    </template>
    <button type="button" class="new" data-testid="new-colour-set" @click="emit('create')">
      + New set from current
    </button>
  </aside>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.list.compact {
  flex-flow: row wrap;
  align-items: center;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title {
  margin: 0;
  padding: var(--space-1) 6px;
}

.set {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-1);
  font-size: var(--text-md);
  text-align: left;
  cursor: pointer;
}

.set:hover {
  background: var(--field);
}

.set.on {
  background: var(--selection);
}

.name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.modified {
  color: var(--warning);
  font-size: var(--text-xs);
}

.new {
  min-height: 36px;
  padding: 0 10px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  background: transparent;
  color: var(--text-3);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.new:hover {
  color: var(--text-1);
}
</style>
