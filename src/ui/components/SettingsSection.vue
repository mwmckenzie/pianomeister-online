<script setup lang="ts">
import { computed } from 'vue'

import type { SettingGroup } from '@/core/settings/SettingGroup'

import { useResetWithUndo } from '../settings/useResetWithUndo'
import AppButton from './AppButton.vue'

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
</script>

<template>
  <section class="settings-section" :aria-label="title" :data-testid="`section-${sectionId}`">
    <h3 v-if="showTitle" class="section-caps title">{{ title }}</h3>
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

.footer {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-1);
}
</style>
