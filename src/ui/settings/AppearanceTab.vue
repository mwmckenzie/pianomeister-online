<script setup lang="ts">
import { computed } from 'vue'

import { THEME_PRESETS } from '@/core/color/THEME_PRESETS'

import type { NoteColourSetId } from '@/core/settings/NoteColourSetId'

import AppButton from '../components/AppButton.vue'
import SettingRow from '../components/SettingRow.vue'
import SettingsSection from '../components/SettingsSection.vue'
import ColourStrip from '../colours/ColourStrip.vue'
import { useColourSets } from '../colours/useColourSets'
import { useSettingsStore } from '../stores/settingsStore'

const emit = defineEmits<{ editColours: [id: NoteColourSetId] }>()

const settings = useSettingsStore()

const palette = computed(() => settings.settings.notes.palette)
const { builtIn, custom } = useColourSets(palette)
const sets = computed(() => [...builtIn.value, ...custom.value])

/** The preset whose colours are in use, if any (presets aren't stored, decision 52). */
const activePreset = computed(() => {
  const { primary, secondary } = settings.settings.appearance
  return THEME_PRESETS.find(
    (p) => p.primary === primary.toUpperCase() && p.secondary === secondary.toUpperCase(),
  )?.name
})

function applyPreset(preset: (typeof THEME_PRESETS)[number]): void {
  settings.set('appearance.primary', preset.primary)
  settings.set('appearance.secondary', preset.secondary)
}
</script>

<template>
  <SettingsSection section-id="menuColors" title="Menu colors">
    <p class="hint">
      Buttons, sliders, selection and focus use the primary colour; ranges and highlights use the
      secondary. Notes keep their own colours.
    </p>
    <div class="presets" role="group" aria-label="Color presets">
      <button
        v-for="preset in THEME_PRESETS"
        :key="preset.name"
        type="button"
        class="preset"
        :class="{ active: activePreset === preset.name }"
        :aria-pressed="activePreset === preset.name"
        :data-testid="`preset-${preset.name.toLowerCase()}`"
        @click="applyPreset(preset)"
      >
        <span class="swatches">
          <span class="swatch" :style="{ background: preset.primary }" />
          <span class="swatch" :style="{ background: preset.secondary }" />
        </span>
        {{ preset.name }}
      </button>
    </div>
    <SettingRow setting-key="appearance.primary" />
    <SettingRow setting-key="appearance.secondary" />
  </SettingsSection>
  <SettingsSection section-id="noteColours" title="Note colours">
    <p class="hint">Change the built-in sets or make your own. Each look picks the set it uses.</p>
    <ul class="sets" role="list">
      <li v-for="set in sets" :key="set.id" class="set">
        <ColourStrip :colours="set.colours" />
        {{ set.name }}<span v-if="set.modified" class="modified">modified</span>
      </li>
    </ul>
    <AppButton size="sm" data-testid="open-colour-editor" @click="emit('editColours', palette)">
      Edit colours…
    </AppButton>
  </SettingsSection>
  <SettingsSection section-id="glass" title="Glass panels">
    <SettingRow setting-key="appearance.panelOpacity" />
    <SettingRow setting-key="appearance.blur" />
  </SettingsSection>
  <SettingsSection section-id="motion" title="Motion">
    <SettingRow setting-key="appearance.motion" />
  </SettingsSection>
  <SettingsSection section-id="playerControls" title="Player controls">
    <SettingRow setting-key="appearance.hideControls" />
    <SettingRow setting-key="appearance.hideControlsAfter" />
  </SettingsSection>
  <SettingsSection section-id="start" title="Start">
    <SettingRow setting-key="appearance.startOn" />
    <SettingRow setting-key="appearance.homeOnNewSession" />
    <SettingRow setting-key="appearance.sessionGap" />
  </SettingsSection>
  <SettingsSection section-id="listening" title="Listening">
    <SettingRow setting-key="appearance.listeningHud" />
  </SettingsSection>
</template>

<style scoped>
.hint {
  margin: 0 0 var(--space-3);
  color: var(--text-3);
  font-size: var(--text-sm);
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.preset {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: 0 var(--space-4) 0 var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--field);
  color: var(--text-2);
  cursor: pointer;
}

.preset:hover {
  color: var(--text-1);
}

.preset.active {
  border-color: var(--primary);
  color: var(--text-1);
}

.sets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0 0 var(--space-3);
  padding: 0;
  list-style: none;
}

.set {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-2);
  font-size: var(--text-sm);
}

.modified {
  color: var(--warning);
  font-size: var(--text-xs);
}

.swatches {
  display: inline-flex;
}

.swatch {
  width: 22px;
  height: 22px;
  border: 2px solid rgb(var(--glass-rgb));
  border-radius: 50%;
}

.swatch + .swatch {
  margin-left: -8px;
}
</style>
