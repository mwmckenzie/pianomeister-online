<script setup lang="ts">
import { computed } from 'vue'

import type { SettingKey } from '@/core/settings/SettingKey'
import { settingGroupKeys } from '@/core/settings/settingGroups'
import { SETTINGS_LAYOUT } from '@/core/settings/SETTINGS_LAYOUT'

import AppAccordion from '../components/AppAccordion.vue'
import AppButton from '../components/AppButton.vue'
import IconButton from '../components/IconButton.vue'
import SettingRow from '../components/SettingRow.vue'
import SettingsSection from '../components/SettingsSection.vue'
import { useResetWithUndo } from '../settings/useResetWithUndo'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStateStore } from '../stores/uiStateStore'
import RenderReadout from './RenderReadout.vue'
import type { RenderStatus } from './RenderStatus'

/**
 * The playfield panel (decision 50): every setting that changes the highway, beside the live
 * view, in accordion sections. Rows come from the registry; the highway's colour rows are
 * grouped under their own heading.
 */
defineProps<{ readonly renderStatus?: () => RenderStatus | null }>()
const emit = defineEmits<{ close: []; openSettings: [] }>()

const settings = useSettingsStore()
const ui = useUiStateStore()
const resetWithUndo = useResetWithUndo()

const sections = computed(() =>
  SETTINGS_LAYOUT.sidebar.map((s) => ({
    value: s.id,
    title: s.title,
    changed: settings.changedCount({ kind: 'section', id: s.id }) > 0,
  })),
)

const keysOf = (id: (typeof SETTINGS_LAYOUT.sidebar)[number]['id']): readonly SettingKey[] =>
  settingGroupKeys({ kind: 'section', id })

const isColorRow = (key: SettingKey) => key.startsWith('colors.') || key.startsWith('opacity.')
const highwayMain = computed(() => keysOf('highway').filter((k) => !isColorRow(k)))
const highwayColors = computed(() => keysOf('highway').filter(isColorRow))
</script>

<template>
  <aside class="sidebar glass" aria-label="Playfield" data-testid="playfield-sidebar">
    <header class="top">
      <div>
        <h2 class="title">Playfield</h2>
        <p class="subtitle">Changes show live on the highway.</p>
      </div>
      <IconButton
        icon="close"
        label="Close playfield panel"
        variant="filled"
        data-testid="close-sidebar"
        @click="emit('close')"
      />
    </header>

    <div class="scroll">
      <AppAccordion v-model="ui.sidebarSections" :items="sections">
        <template v-for="section in SETTINGS_LAYOUT.sidebar" :key="section.id" #[section.id]>
          <SettingsSection
            :section-id="section.id"
            :title="section.title"
            :reset-label="'resetLabel' in section ? section.resetLabel : undefined"
            :show-title="false"
          >
            <template v-if="section.id === 'highway'">
              <SettingRow v-for="key in highwayMain" :key="key" :setting-key="key" />
              <h4 class="section-caps sub">Colors</h4>
              <SettingRow v-for="key in highwayColors" :key="key" :setting-key="key" />
            </template>
            <template v-else>
              <SettingRow v-for="key in keysOf(section.id)" :key="key" :setting-key="key" />
            </template>
            <RenderReadout v-if="section.id === 'render'" :render-status="renderStatus" />
          </SettingsSection>
        </template>
      </AppAccordion>
    </div>

    <footer class="bottom">
      <AppButton data-testid="open-all-settings" @click="emit('openSettings')">
        All settings…
      </AppButton>
      <AppButton
        variant="text"
        size="sm"
        icon="reset"
        data-testid="reset-sidebar"
        @click="resetWithUndo({ kind: 'sidebar' }, 'Playfield settings')"
      >
        Reset all playfield settings
      </AppButton>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 360px;
  height: 100%;
  min-height: 0;
  border-width: 0 0 0 1px;
  border-radius: 0;
  box-shadow: none;
}

.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-6) var(--space-4);
  border-bottom: 1px solid var(--divider);
}

.title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
}

.subtitle {
  margin: var(--space-2) 0 0;
  color: var(--text-2);
  font-size: var(--text-md);
}

.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sub {
  margin: var(--space-4) 0 var(--space-1);
}

.bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--divider);
}
</style>
