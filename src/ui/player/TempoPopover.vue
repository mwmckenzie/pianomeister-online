<script setup lang="ts">
import { computed } from 'vue'

import { tempoSliderRange } from '@/core/practice/tempoSliderRange'

import AppButton from '../components/AppButton.vue'
import AppPopover from '../components/AppPopover.vue'
import SliderField from '../components/SliderField.vue'
import { usePracticeStore } from '../stores/practiceStore'
import { useSettingsStore } from '../stores/settingsStore'
import HudToggle from './HudToggle.vue'

/**
 * The HUD's tempo row: "85%" in the primary colour while the tempo isn't 100%, then the tempo
 * icon, which opens the tempo slider (25–200% of the song's tempo, brief decision 60). Tempo is
 * practice state, not a setting, so it resets to 100% by button.
 */
const props = defineProps<{
  readonly currentBpm: number
  readonly tempoPercent: number
}>()
const emit = defineEmits<{ 'update:tempoPercent': [value: number] }>()
const open = defineModel<boolean>('open', { default: false })
const practice = usePracticeStore()
const settings = useSettingsStore()
/** The Practice tab's tempo step (decision 81), with 100% always on the slider's grid. */
const slider = computed(() => tempoSliderRange(settings.settings.practice.tempoStep))
/** Reset goes back to the loaded bookmark's tempo, or 100% for Full song (decision 69). */
const resetTo = computed(() => practice.saved.tempoPercent)
</script>

<template>
  <div class="tempo-row">
    <span v-if="tempoPercent !== 100" class="value" data-testid="tempo-value"
      >{{ tempoPercent }}%</span
    >
    <span class="spacer" aria-hidden="true" />
    <AppPopover
      v-model:open="open"
      side="left"
      align="start"
      label="Tempo"
      data-testid="tempo-popover"
    >
      <template #trigger>
        <HudToggle
          icon="tempo"
          :on="props.tempoPercent !== 100"
          :aria-label="`Tempo ${tempoPercent}%: open tempo`"
          data-testid="open-tempo"
        />
      </template>
      <div class="head">
        <span class="label">Tempo</span>
        <output class="value-out">{{ tempoPercent }}%</output>
      </div>
      <SliderField
        :model-value="tempoPercent"
        :min="slider.min"
        :max="slider.max"
        :step="slider.step"
        label="Tempo percent"
        :value-text="`${tempoPercent}%`"
        data-testid="tempo-slider"
        @update:model-value="emit('update:tempoPercent', $event)"
      />
      <div class="foot">
        <span class="hint">{{ currentBpm.toFixed(0) }} bpm now</span>
        <AppButton
          variant="text"
          size="sm"
          icon="reset"
          :disabled="tempoPercent === resetTo"
          data-testid="tempo-reset"
          @click="emit('update:tempoPercent', resetTo)"
        >
          Reset to {{ resetTo }}%
        </AppButton>
      </div>
    </AppPopover>
  </div>
</template>

<style scoped>
.tempo-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.value {
  color: var(--primary);
  font-size: var(--text-sm);
  text-shadow: var(--text-shadow-hud);
}

/* Lines the icon up under the loop icon (the loop row has a caret here). */
.spacer {
  width: 20px;
}

.head,
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label,
.value-out {
  font-size: var(--text-md);
}

.hint {
  color: var(--text-3);
  font-size: var(--text-sm);
}
</style>
