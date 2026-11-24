<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'

import { NOTE_LABELS } from '@/core/color/NOTE_LABELS'

/** One octave of keys showing a set's colours; pick one by click or with the arrow keys. */
const props = defineProps<{
  readonly colours: readonly string[]
  readonly changed: ReadonlySet<number>
}>()
const selected = defineModel<number>({ required: true })
const box = useTemplateRef<HTMLElement>('box')

const WHITE = [0, 2, 4, 5, 7, 9, 11]
/** Keys in pitch order, so Tab, arrows and screen readers go C to B; positions in white keys. */
const keys = NOTE_LABELS.map((name, pc) => {
  const white = WHITE.indexOf(pc)
  const black = white < 0
  return { name, pc, black, left: black ? WHITE.indexOf(pc - 1) + 1 : white }
})

const label = (pc: number) =>
  `${NOTE_LABELS[pc]}: ${props.colours[pc]}${props.changed.has(pc) ? ', modified' : ''}`

const MOVES: Readonly<Record<string, (pc: number) => number>> = {
  ArrowRight: (pc) => (pc + 1) % 12,
  ArrowUp: (pc) => (pc + 1) % 12,
  ArrowLeft: (pc) => (pc + 11) % 12,
  ArrowDown: (pc) => (pc + 11) % 12,
  Home: () => 0,
  End: () => 11,
}

async function onKeyDown(event: KeyboardEvent): Promise<void> {
  const move = MOVES[event.key]
  if (move === undefined || event.altKey || event.ctrlKey || event.metaKey) return
  event.preventDefault()
  event.stopPropagation()
  selected.value = move(selected.value)
  await nextTick()
  box.value?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
}
</script>

<template>
  <div ref="box" class="octave" role="radiogroup" aria-label="Notes" @keydown="onKeyDown">
    <button
      v-for="key in keys"
      :key="key.pc"
      type="button"
      role="radio"
      class="key"
      :class="{ black: key.black, on: key.pc === selected }"
      :style="{ '--at': key.left }"
      :aria-checked="key.pc === selected"
      :aria-label="label(key.pc)"
      :tabindex="key.pc === selected ? 0 : -1"
      :data-testid="`colour-key-${key.pc}`"
      :data-colour="colours[key.pc]"
      :data-modified="changed.has(key.pc) ? 'true' : undefined"
      @click="selected = key.pc"
    >
      <span
        class="dot"
        :class="{ changed: changed.has(key.pc) }"
        :style="{ background: colours[key.pc] }"
      />
      <span class="note">{{ key.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.octave {
  --key: calc(100% / 7);

  position: relative;
  width: 100%;
  max-width: 588px;
  height: 150px;
}

.key {
  position: absolute;
  top: 0;
  left: calc(var(--at) * var(--key) + 2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  width: calc(var(--key) - 4px);
  height: 150px;
  padding: 0 0 12px;
  border: 1px solid rgb(0 0 0 / 20%);
  border-radius: 0 0 10px 10px;
  background: #e9ecf4;
  color: #2a3046;
  cursor: pointer;
}

.key.black {
  z-index: 1;
  left: calc(var(--at) * var(--key) - var(--key) * 0.31);
  width: calc(var(--key) * 0.62);
  height: 92px;
  padding-bottom: 8px;
  border-color: var(--border);
  background: #1a2034;
  color: var(--text-2);
}

.key.on {
  border: 3px solid var(--primary);
}

.dot {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  box-shadow: 0 0 0 2px rgb(0 0 0 / 25%);
}

.dot.changed {
  box-shadow:
    0 0 0 2px rgb(0 0 0 / 25%),
    0 0 0 4px var(--warning);
}

.note {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}
</style>
