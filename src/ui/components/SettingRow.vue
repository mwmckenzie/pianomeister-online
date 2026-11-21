<script setup lang="ts">
import { computed, useId } from 'vue'

import { formatSettingValue } from '@/core/settings/formatSettingValue'
import type { SettingKey } from '@/core/settings/SettingKey'

import type { SettingOverride } from './SettingOverride'
import { settingMax } from '@/core/settings/settingMax'
import { settingDefinition } from '@/core/settings/settingValues'

import { useSettingsStore } from '../stores/settingsStore'
import ColorField from './ColorField.vue'
import ResetButton from './ResetButton.vue'
import SegmentedControl from './SegmentedControl.vue'
import SelectField from './SelectField.vue'
import SliderField from './SliderField.vue'
import ToggleField from './ToggleField.vue'

/**
 * One setting, rendered entirely from the registry: label, current value, the control that
 * fits its type, and the reset button (decision 51). A new setting needs only a registry entry
 * and one <SettingRow> line.
 */
const props = defineProps<{
  readonly settingKey: SettingKey
  /** Number settings: run the slider right to left (e.g. pre-roll, counting back from a bar). */
  readonly inverted?: boolean
  /** Number settings: replaces the formatted value, e.g. "4 beats before bar 17". */
  readonly valueText?: string
  /** Number settings: a marker label at the slider's low end (its right end when inverted). */
  readonly endLabel?: string
  /**
   * Shows and edits a value other than the stored setting, e.g. a loaded bookmark's temporary
   * value (brief decision 69): `changed` drives the reset icon, `reset` its action.
   */
  readonly override?: SettingOverride
}>()

const store = useSettingsStore()
const def = computed(() => settingDefinition(props.settingKey))
const visible = computed(() => def.value.visible?.(store.settings) ?? true)
const enabled = computed(() => def.value.enabled?.(store.settings) ?? true)
/** Why the control is greyed out (e.g. "Needs shader detail Medium or High"). */
const hint = computed(() => (enabled.value ? null : (def.value.disabledHint ?? null)))
const value = computed(() =>
  props.override === undefined ? store.get(props.settingKey) : props.override.value,
)
const changed = computed(() =>
  props.override === undefined ? !store.isDefault(props.settingKey) : props.override.changed,
)
const testid = computed(() => `setting-${props.settingKey.replace('.', '-')}`)
const id = useId()

const number = computed(() => {
  const d = def.value
  if (d.kind !== 'number') return null
  const v = value.value as number
  return {
    def: d,
    value: v,
    max: settingMax(props.settingKey, store.settings),
    text: props.valueText ?? formatSettingValue(d, v),
  }
})

// The registry guarantees each key's value type matches its kind; the store checks nothing.
function set(next: unknown): void {
  if (props.override !== undefined) props.override.set(next)
  else store.set(props.settingKey, next as never)
}

function reset(): void {
  if (props.override !== undefined) props.override.reset()
  else store.reset(props.settingKey)
}
</script>

<template>
  <div
    v-if="visible"
    class="setting-row"
    :class="`kind-${def.kind}`"
    :data-testid="testid"
    :data-changed="changed"
    :data-disabled="enabled ? undefined : 'true'"
  >
    <template v-if="number">
      <div class="head">
        <label class="label" :for="id">{{ def.label }}</label>
        <output class="value" :data-testid="`${testid}-value`">{{ number.text }}</output>
        <ResetButton
          :changed="changed"
          :setting-label="def.label"
          :data-testid="`${testid}-reset`"
          @reset="reset"
        />
      </div>
      <SliderField
        :id="id"
        :model-value="number.value"
        :min="number.def.min"
        :max="number.max"
        :step="number.def.step"
        :label="def.label"
        :value-text="number.text"
        :inverted="inverted"
        :end-label="endLabel"
        :disabled="!enabled"
        :data-testid="`${testid}-control`"
        @update:model-value="set"
      />
      <p v-if="hint" class="hint" :data-testid="`${testid}-hint`">{{ hint }}</p>
    </template>

    <div v-else class="inline">
      <label v-if="def.kind !== 'choice' || def.control === 'select'" class="label" :for="id">
        {{ def.label }}
      </label>
      <span v-else class="label">{{ def.label }}</span>
      <!-- Control and reset wrap together, so the reset never sits alone on a line. -->
      <span class="end">
        <span class="control">
          <ToggleField
            v-if="def.kind === 'boolean'"
            :id="id"
            :model-value="value as boolean"
            :label="def.label"
            :disabled="!enabled"
            :data-testid="`${testid}-control`"
            @update:model-value="set"
          />
          <SelectField
            v-else-if="def.kind === 'choice' && def.control === 'select'"
            :id="id"
            :model-value="value as string"
            :options="def.options"
            :label="def.label"
            :disabled="!enabled"
            :data-testid="`${testid}-control`"
            @update:model-value="set"
          />
          <SegmentedControl
            v-else-if="def.kind === 'choice'"
            :model-value="value as string"
            :options="def.options"
            :label="def.label"
            :disabled="!enabled"
            :data-testid="`${testid}-control`"
            @update:model-value="set"
          />
          <ColorField
            v-else-if="def.kind === 'color'"
            :model-value="value as string"
            :label="def.label"
            :data-testid="`${testid}-control`"
            @update:model-value="set"
          />
        </span>
        <ResetButton
          :changed="changed"
          :setting-label="def.label"
          :data-testid="`${testid}-reset`"
          @reset="reset"
        />
      </span>
      <p v-if="hint" class="hint" :data-testid="`${testid}-hint`">{{ hint }}</p>
    </div>
  </div>
</template>

<style scoped>
.setting-row {
  padding: var(--space-2) 0;
}

[data-disabled] .label,
[data-disabled] .value {
  color: var(--text-4);
}

.head,
.inline {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.inline {
  flex-wrap: wrap;
  min-height: 44px;
}

/* Choice and colour rows: the label keeps its words on one line; when label and control don't
   fit side by side (narrow sidebar or column), the control moves to its own line. */
.inline .label {
  flex: 1 0 auto;
  min-width: auto;
  white-space: nowrap;
}

.label {
  flex: 1;
  min-width: 0;
  color: var(--text-1);
  font-size: var(--text-md);
}

.value {
  color: var(--text-1);
  font-size: var(--text-md);
  white-space: nowrap;
}

.end {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.control {
  display: inline-flex;
}

.hint {
  flex-basis: 100%;
  margin: var(--space-1) 0 0;
  color: var(--text-3);
  font-size: var(--text-sm);
}

.head + .slider {
  margin-top: var(--space-1);
}
</style>
