<script setup lang="ts">
import { computed, provide, reactive } from 'vue'

import type { SettingGroup } from '@/core/settings/SettingGroup'
import { sharedHints } from '@/core/settings/sharedHints'

import { useResetWithUndo } from '../settings/useResetWithUndo'
import AppButton from './AppButton.vue'
import { sectionHintsKey } from './sectionHintsKey'

/**
 * A titled group of SettingRows ending with its own "Reset ⟨section⟩" (decision 51). The
 * sidebar's accordion shows the title itself, so it can be hidden here.
 */
const props = withDefaults(
  defineProps<{
    readonly sectionId: Extract<SettingGroup, { kind: 'section' }>['id']
    readonly title: string
    /** Overrides "Reset ⟨title⟩", e.g. "Reset keyboard to grand piano". */
    readonly resetLabel?: string
    readonly showTitle?: boolean
  }>(),
  { resetLabel: undefined, showTitle: true },
)

const resetWithUndo = useResetWithUndo()
const label = computed(() => props.resetLabel ?? `Reset ${props.title.toLowerCase()}`)

// Three or more rows greyed out for one reason: say it once at the top, not under every row.
const rowHints = reactive(new Map<symbol, string | null>())
const shared = computed(() => sharedHints(rowHints.values()))
provide(sectionHintsKey, {
  report: (row, hint) => rowHints.set(row, hint),
  forget: (row) => rowHints.delete(row),
  shared,
})
</script>

<template>
  <section class="settings-section" :aria-label="title" :data-testid="`section-${sectionId}`">
    <h3 v-if="showTitle" class="section-caps title">{{ title }}</h3>
    <p
      v-for="hint in shared"
      :key="hint"
      class="hint"
      :data-testid="`section-${sectionId}-hint`"
    >
      {{ hint }}
    </p>
    <slot />
    <div class="footer">
      <AppButton
        variant="text"
        size="sm"
        icon="reset"
        :data-testid="`reset-section-${sectionId}`"
        @click="resetWithUndo({ kind: 'section', id: sectionId }, title)"
      >
        {{ label }}
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
.settings-section {
  padding-bottom: var(--space-4);
}

.title {
  margin-bottom: var(--space-2);
}

.hint {
  margin: 0 0 var(--space-2);
  color: var(--text-3);
  font-size: var(--text-sm);
}

.footer {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-1);
}
</style>
