<script setup lang="ts">
import { computed } from 'vue'

import type { HandAudio } from '@/core/practice/HandAudio'
import type { MetronomeMode } from '@/core/practice/MetronomeMode'

import type { SettingOverride } from '../components/SettingOverride'
import SettingRow from '../components/SettingRow.vue'
import SettingsSection from '../components/SettingsSection.vue'
import { usePracticeStore } from '../stores/practiceStore'

// Still declared: the settings window listens for it on every tab.
defineEmits<{ navigate: [] }>()
const practice = usePracticeStore()

/**
 * With a bookmark loaded, the hand modes shown and changed here are the bookmark's temporary
 * ones; reset goes back to its saved value (brief decision 69). Volumes stay global.
 */
function handOverride(hand: 'right' | 'left') {
  return computed((): SettingOverride | undefined =>
    practice.bookmark === null
      ? undefined
      : {
          value: practice.current.handAudio[hand],
          changed: practice.isTemporary(`handAudio.${hand}`),
          set: (value) => practice.setHandAudio(hand, value as HandAudio),
          reset: () => practice.revertField(`handAudio.${hand}`),
        },
  )
}
const rightOverride = handOverride('right')
const leftOverride = handOverride('left')

/** The metronome mode is part of a bookmark too (decision 61): temporary while one is loaded. */
const metronomeOverride = computed((): SettingOverride | undefined =>
  practice.bookmark === null
    ? undefined
    : {
        value: practice.current.metronomeMode,
        changed: practice.isTemporary('metronomeMode'),
        set: (value) => practice.setMetronomeMode(value as MetronomeMode),
        reset: () => practice.revertField('metronomeMode'),
      },
)
</script>

<template>
  <SettingsSection section-id="volume" title="Volume">
    <SettingRow setting-key="audio.master" />
    <div class="columns">
      <div>
        <SettingRow setting-key="audio.rightVolume" />
        <SettingRow setting-key="audio.rightAudio" :override="rightOverride" />
      </div>
      <div>
        <SettingRow setting-key="audio.leftVolume" />
        <SettingRow setting-key="audio.leftAudio" :override="leftOverride" />
      </div>
    </div>
  </SettingsSection>
  <SettingsSection section-id="preRollMetronome" title="Pre-roll & metronome">
    <div class="columns">
      <SettingRow setting-key="audio.quietLevel" />
      <SettingRow setting-key="audio.metronomeVolume" />
    </div>
    <SettingRow setting-key="audio.metronomeMode" :override="metronomeOverride" />
  </SettingsSection>
  <SettingsSection section-id="soundSource" title="Sound source">
    <SettingRow setting-key="audio.output" />
  </SettingsSection>
  <SettingsSection section-id="playback" title="Playback">
    <SettingRow setting-key="audio.crossfade" />
  </SettingsSection>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0 var(--space-10);
}
</style>
