<script setup lang="ts">
import { computed, ref } from 'vue'

import type { SettingsTabId } from '@/core/settings/SettingHome'
import { SETTINGS_LAYOUT } from '@/core/settings/SETTINGS_LAYOUT'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import IconButton from '../components/IconButton.vue'
import TabbedWindow from '../components/TabbedWindow.vue'
import { useSettingsStore } from '../stores/settingsStore'
import AboutTab from './AboutTab.vue'
import AppearanceTab from './AppearanceTab.vue'
import AudioTab from './AudioTab.vue'
import LibraryDataTab from './LibraryDataTab.vue'
import PracticeTab from './PracticeTab.vue'
import ProfilesTab from './ProfilesTab.vue'
import { useResetWithUndo } from './useResetWithUndo'

/**
 * The settings window (decision 50): everything that isn't on the playfield. Tabs with
 * nothing to show yet (General, MIDI, Shortcuts) are left out until they have content.
 */
const emit = defineEmits<{ openPlayfield: [] }>()
const open = defineModel<boolean>('open', { required: true })

const settings = useSettingsStore()
const resetWithUndo = useResetWithUndo()

type TabId = SettingsTabId | 'profiles' | 'library' | 'about'
const active = ref<TabId>('practice')

const settingTabs = new Set<string>(SETTINGS_LAYOUT.tabs.map((t) => t.id))
const isSettingsTab = (id: string): id is SettingsTabId => settingTabs.has(id)

const tabs = computed(() => [
  ...SETTINGS_LAYOUT.tabs.map((t) => ({
    value: t.id,
    title: t.title,
    changed: settings.changedCount({ kind: 'tab', id: t.id }) > 0,
  })),
  { value: 'profiles', title: 'Profiles' },
  { value: 'library', title: 'Library & data' },
  { value: 'about', title: 'About' },
])
const activeTitle = computed(() => tabs.value.find((t) => t.value === active.value)?.title ?? '')
const changed = computed(() =>
  isSettingsTab(active.value) ? settings.changedCount({ kind: 'tab', id: active.value }) : 0,
)
</script>

<template>
  <AppDialog
    v-model:open="open"
    title="Settings"
    width="980px"
    height="620px"
    data-testid="settings-window"
  >
    <TabbedWindow v-model="active" title="Settings" :tabs="tabs">
      <template #header>
        <header class="head">
          <h3 class="tab-title">{{ activeTitle }}</h3>
          <IconButton
            icon="close"
            label="Close settings"
            variant="filled"
            data-testid="close-settings"
            @click="open = false"
          />
        </header>
      </template>
      <template #practice><PracticeTab @navigate="open = false" /></template>
      <template #audio><AudioTab @navigate="open = false" /></template>
      <template #appearance><AppearanceTab /></template>
      <template #profiles><ProfilesTab /></template>
      <template #library><LibraryDataTab /></template>
      <template #about><AboutTab /></template>
      <template #nav-footer>
        <p class="nav-note">Camera, keyboard and note looks live in the playfield panel.</p>
        <AppButton size="sm" data-testid="open-playfield" @click="emit('openPlayfield')">
          Open playfield panel
        </AppButton>
      </template>
      <template #footer>
        <footer v-if="isSettingsTab(active)" class="foot">
          <span class="count" data-testid="changed-count">
            {{ changed }} {{ changed === 1 ? 'setting' : 'settings' }} changed from default
          </span>
          <AppButton
            icon="reset"
            :data-testid="`reset-tab-${active}`"
            @click="resetWithUndo({ kind: 'tab', id: active }, `${activeTitle} settings`)"
          >
            Reset all {{ activeTitle }} settings
          </AppButton>
        </footer>
      </template>
    </TabbedWindow>
  </AppDialog>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 30px 10px;
}

.tab-title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--weight-medium);
}

.nav-note {
  margin: 0 0 var(--space-3);
  color: var(--text-3);
  font-size: var(--text-sm);
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 12px 30px;
  border-top: 1px solid var(--divider);
}

.count {
  color: var(--text-4);
  font-size: var(--text-sm);
}
</style>
