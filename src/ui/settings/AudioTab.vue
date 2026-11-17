<script setup lang="ts">
import SettingRow from '../components/SettingRow.vue'
import SettingsSection from '../components/SettingsSection.vue'
</script>

<template>
  <SettingsSection section-id="volume" title="Volume">
    <SettingRow setting-key="audio.master" />
    <div class="columns">
      <div>
        <SettingRow setting-key="audio.rightVolume" />
        <SettingRow setting-key="audio.rightAudio" />
      </div>
      <div>
        <SettingRow setting-key="audio.leftVolume" />
        <SettingRow setting-key="audio.leftAudio" />
      </div>
    </div>
  </SettingsSection>
  <SettingsSection section-id="preRollMetronome" title="Pre-roll & metronome">
    <div class="columns">
      <SettingRow setting-key="audio.quietLevel" />
      <SettingRow setting-key="audio.metronomeVolume" />
    </div>
    <SettingRow setting-key="audio.metronomeMode" />
  </SettingsSection>
  <SettingsSection section-id="soundSource" title="Sound source">
    <SettingRow setting-key="audio.output" />
  </SettingsSection>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0 var(--space-10);
}
</style>
