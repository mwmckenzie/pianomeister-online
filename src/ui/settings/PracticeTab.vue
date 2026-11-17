<script setup lang="ts">
import SettingRow from '../components/SettingRow.vue'
import SettingsSection from '../components/SettingsSection.vue'
</script>

<template>
  <SettingsSection section-id="preRoll" title="Pre-roll">
    <p class="hint">
      Beats counted in before you play, after any jump and on every loop. The Full song uses these;
      bookmarks (milestone 7) can override them.
    </p>
    <SettingRow setting-key="practice.preRollBeats" />
    <SettingRow setting-key="practice.preRollMode" />
  </SettingsSection>
</template>

<style scoped>
.hint {
  margin: 0 0 var(--space-2);
  color: var(--text-3);
  font-size: var(--text-sm);
}
</style>
