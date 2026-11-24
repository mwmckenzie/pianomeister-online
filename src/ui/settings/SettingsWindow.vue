<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { SettingsTabId } from '@/core/settings/SettingHome'
import { SETTINGS_LAYOUT } from '@/core/settings/SETTINGS_LAYOUT'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import IconButton from '../components/IconButton.vue'
import TabbedWindow from '../components/TabbedWindow.vue'
import { pageListCommand } from '../input/pageListCommand'
import { useWindowKeys } from '../input/useWindowKeys'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { useUiStateStore } from '../stores/uiStateStore'
import AboutTab from './AboutTab.vue'
import AppearanceTab from './AppearanceTab.vue'
import AudioTab from './AudioTab.vue'
import LibraryDataTab from './LibraryDataTab.vue'
import PracticeTab from './PracticeTab.vue'
import ProfilesTab from './ProfilesTab.vue'
import ShortcutsTab from './ShortcutsTab.vue'
import { useResetWithUndo } from './useResetWithUndo'

/**
 * The settings window (decision 50): everything that isn't on the playfield. Tabs with
 * nothing to show yet (General, MIDI) are left out until they have content.
 */
const emit = defineEmits<{ openPlayfield: [] }>()
const open = defineModel<boolean>('open', { required: true })

const settings = useSettingsStore()
const resetWithUndo = useResetWithUndo()
const toasts = useToastStore()

type TabId = SettingsTabId | 'shortcuts' | 'profiles' | 'about'
const active = ref<TabId>('practice')
const ui = useUiStateStore()

// Opened for a particular tab (the cheat sheet's "Change shortcuts…"): show it once.
watch(
  () => [open.value, ui.settingsTabRequest] as const,
  ([isOpen, tab]) => {
    if (!isOpen || tab === null) return
    active.value = tab as TabId
    ui.settingsTabRequest = null
  },
  { immediate: true },
)

const settingTabs = new Set<string>(SETTINGS_LAYOUT.tabs.map((t) => t.id))
const isSettingsTab = (id: string): id is SettingsTabId => settingTabs.has(id)

/** Commands whose keys differ from the default (decision 88). */
const shortcutsChanged = computed(() => Object.keys(settings.shortcuts).length)

/** Reset all shortcuts at once, with Undo (decision 51). */
function resetShortcuts(): void {
  if (shortcutsChanged.value === 0) return
  const previous = settings.editShortcuts({ type: 'resetAll' })
  toasts.showUndo('Shortcuts reset to defaults', () => settings.restoreShortcuts(previous))
}

const tabs = computed(() => {
  const settingsTabs = SETTINGS_LAYOUT.tabs.map((t) => ({
    value: t.id,
    title: t.title,
    changed: settings.changedCount({ kind: 'tab', id: t.id }) > 0,
  }))
  return [
    ...settingsTabs.filter((t) => t.value !== 'library'),
    { value: 'shortcuts', title: 'Shortcuts', changed: shortcutsChanged.value > 0 },
    { value: 'profiles', title: 'Profiles' },
    ...settingsTabs.filter((t) => t.value === 'library'),
    { value: 'about', title: 'About' },
  ]
})
/** Next / Previous tab (decision 90) step through the tabs and wrap around. */
function onKeyDown(event: KeyboardEvent): void {
  const command = pageListCommand(
    event,
    settings.bindings,
    document.querySelector<HTMLElement>('[data-testid="settings-window"]'),
  )
  if (command !== 'nextTab' && command !== 'previousTab') return
  event.preventDefault()
  const list = tabs.value
  const index = list.findIndex((t) => t.value === active.value)
  const step = command === 'nextTab' ? 1 : -1
  const next = list[(index + step + list.length) % list.length]
  if (next !== undefined) active.value = next.value as TabId
}
useWindowKeys(() => open.value, onKeyDown)

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
      <template #shortcuts><ShortcutsTab /></template>
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
        <footer v-else-if="active === 'shortcuts'" class="foot">
          <span class="count" data-testid="changed-count">
            {{ shortcutsChanged }} {{ shortcutsChanged === 1 ? 'shortcut' : 'shortcuts' }} changed
            from default
          </span>
          <AppButton icon="reset" data-testid="reset-tab-shortcuts" @click="resetShortcuts">
            Reset all shortcuts
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
