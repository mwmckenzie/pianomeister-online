<script setup lang="ts">
import SettingRow from '../components/SettingRow.vue'
import SettingsSection from '../components/SettingsSection.vue'
import DefaultsNote from './DefaultsNote.vue'

const emit = defineEmits<{ navigate: [] }>()
</script>

<template>
  <SettingsSection section-id="tempo" title="Tempo">
    <p class="hint">How far each step of the tempo slider (and its arrow keys) moves the tempo.</p>
    <SettingRow setting-key="practice.tempoStep" />
  </SettingsSection>
  <SettingsSection section-id="preRoll" title="Pre-roll">
    <p class="hint">
      Beats counted in before you play, after any jump and on every loop. Full song uses these; each
      bookmark saves its own.
    </p>
    <SettingRow setting-key="practice.preRollBeats" />
    <SettingRow setting-key="practice.preRollMode" />
    <!-- Global even while a bookmark is loaded (decision 68): say so, and where to edit it. -->
    <DefaultsNote class="note" @navigate="emit('navigate')" />
  </SettingsSection>
</template>

<style scoped>
.note {
  margin-top: var(--space-2);
}

.hint {
  margin: 0 0 var(--space-2);
  color: var(--text-3);
  font-size: var(--text-sm);
}
</style>
