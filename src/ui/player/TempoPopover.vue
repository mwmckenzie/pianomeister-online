<script setup lang="ts">
import AppButton from '../components/AppButton.vue'
import AppPopover from '../components/AppPopover.vue'
import SliderField from '../components/SliderField.vue'
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
        :min="25"
        :max="200"
        :step="5"
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
          :disabled="tempoPercent === 100"
          @click="emit('update:tempoPercent', 100)"
        >
          Reset to 100%
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
