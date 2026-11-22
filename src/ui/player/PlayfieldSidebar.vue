<script setup lang="ts">
import { computed, ref } from 'vue'

import type { SettingKey } from '@/core/settings/SettingKey'
import { settingGroupKeys } from '@/core/settings/settingGroups'
import { isQualityModified } from '@/core/settings/applyQualityPreset'
import { SETTINGS_LAYOUT } from '@/core/settings/SETTINGS_LAYOUT'
import { settingDefinition } from '@/core/settings/settingValues'

import AppAccordion from '../components/AppAccordion.vue'
import AppButton from '../components/AppButton.vue'
import IconButton from '../components/IconButton.vue'
import SettingRow from '../components/SettingRow.vue'
import SettingsSection from '../components/SettingsSection.vue'
import { useResetWithUndo } from '../settings/useResetWithUndo'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStateStore } from '../stores/uiStateStore'
import LookPicker from './LookPicker.vue'
import RenderReadout from './RenderReadout.vue'
import type { RenderStatus } from './RenderStatus'
import { useLooks } from './useLooks'

/**
 * The playfield panel (decision 50): every setting that changes the highway, beside the live
 * view, in accordion sections (one open at a time, brief decision 50). Rows come from the registry; the highway's colour rows are
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

type SectionId = (typeof SETTINGS_LAYOUT.sidebar)[number]['id']

/**
 * A section's rows split at each subheading (the registry's `group`); a subheading shows only
 * while one of its rows is visible.
 */
function blocksOf(id: SectionId): readonly { title?: string; keys: readonly SettingKey[] }[] {
  const blocks: { title?: string; keys: SettingKey[] }[] = []
  for (const key of settingGroupKeys({ kind: 'section', id })) {
    const title = settingDefinition(key).group
    const last = blocks.at(-1)
    if (last !== undefined && last.title === title) last.keys.push(key)
    else blocks.push({ title, keys: [key] })
  }
  return blocks
}

/** Look files dropped anywhere on the panel are imported (never applied). */
const { importFile } = useLooks()
const dropping = ref(false)
const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

function onDragOver(event: DragEvent): void {
  if (!carriesFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
  dropping.value = true
}

function onDragLeave(event: DragEvent): void {
  // Leaving for a child of the panel isn't leaving the panel.
  const to = event.relatedTarget
  if (!(to instanceof Node) || !(event.currentTarget as HTMLElement).contains(to)) {
    dropping.value = false
  }
}

async function onDrop(event: DragEvent): Promise<void> {
  if (!carriesFiles(event)) return
  event.preventDefault()
  dropping.value = false
  for (const file of event.dataTransfer?.files ?? []) await importFile(file)
}

const qualityModified = computed(() => isQualityModified(settings.settings.render))
const qualityLabel = computed(() => {
  const q = settings.settings.render.quality
  return q.charAt(0).toUpperCase() + q.slice(1)
})

const isVisible = (key: SettingKey) => settingDefinition(key).visible?.(settings.settings) ?? true
const blocks = computed(() =>
  Object.fromEntries(
    SETTINGS_LAYOUT.sidebar.map((s) => [
      s.id,
      blocksOf(s.id).map((b) => ({ ...b, shown: b.keys.some(isVisible) })),
    ]),
  ),
)
</script>

<template>
  <aside
    class="sidebar glass"
    :class="{ dropping }"
    aria-label="Playfield"
    data-testid="playfield-sidebar"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
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

    <!-- Outside the sections and the scroll area: always at the top. -->
    <LookPicker />
    <div class="scroll">
      <AppAccordion v-model="ui.sidebarSection" :items="sections">
        <template v-for="section in SETTINGS_LAYOUT.sidebar" :key="section.id" #[section.id]>
          <SettingsSection
            :section-id="section.id"
            :title="section.title"
            :reset-label="'resetLabel' in section ? section.resetLabel : undefined"
            :show-title="false"
          >
            <template v-for="(block, i) in blocks[section.id]" :key="i">
              <h4 v-if="block.title !== undefined && block.shown" class="section-caps sub">
                {{ block.title }}
              </h4>
              <SettingRow v-for="key in block.keys" :key="key" :setting-key="key" />
              <p
                v-if="section.id === 'render' && block.title === 'Quality' && qualityModified"
                class="modified"
                data-testid="quality-status"
              >
                {{ qualityLabel }} · modified
              </p>
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

/* A look file held over the panel: dropping it imports it. */
.sidebar.dropping {
  outline: 2px dashed var(--primary);
  outline-offset: -6px;
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

.modified {
  margin: var(--space-1) 0 0;
  color: var(--text-2);
  font-size: var(--text-sm);
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
