<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { LibraryEntry } from '@/core/library/LibraryEntry'
import { adjustLoopRange } from '@/core/practice/adjustLoopRange'
import type { Bookmark } from '@/core/practice/Bookmark'
import type { BookmarkEdit } from '@/core/practice/BookmarkEdit'
import { clampRange } from '@/core/practice/clampRange'
import type { HandAudio } from '@/core/practice/HandAudio'
import type { MetronomeMode } from '@/core/practice/MetronomeMode'
import { newBookmarkConfig } from '@/core/practice/practiceDefaults'
import { tempoSliderRange } from '@/core/practice/tempoSliderRange'
import { formatLastPracticed } from '@/core/stats/formatLastPracticed'
import { formatPlayedTimes } from '@/core/stats/formatPlays'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'
import type { PreRollMode } from '@/core/transport/PreRollMode'

import AppButton from '../components/AppButton.vue'
import PracticeChart from '../components/PracticeChart.vue'
import RangeSliderField from '../components/RangeSliderField.vue'
import ResetButton from '../components/ResetButton.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import SliderField from '../components/SliderField.vue'
import StatsTriple from '../components/StatsTriple.vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useStatsStore } from '../stores/statsStore'

/**
 * The bookmark manager's edit panel (QGBookmarks source, brief decision 69): the only place a
 * bookmark is edited. Every change goes straight to the manager as an edit; each field has a
 * reset icon back to what a new bookmark starts with, and the name's reset makes it automatic
 * again (it then follows the settings). A draft duplicate says so at the top.
 */
const props = defineProps<{
  readonly song: LibraryEntry
  readonly bookmark: Bookmark
  /** A draft's source name: it's kept only once something changes. */
  readonly duplicateOf: string | null
  /** Another bookmark with the same settings. */
  readonly sameAs: string | null
  readonly isDraft: boolean
}>()
const emit = defineEmits<{ edit: [edit: BookmarkEdit]; load: []; duplicate: []; delete: [] }>()

const stats = useStatsStore()
const settings = useSettingsStore()

const lastBar = computed(() => Math.max(1, props.song.bars))
const defaults = computed(() => newBookmarkConfig(settings.settings, lastBar.value))
const config = computed(() => props.bookmark.config)
const tempoSlider = computed(() => tempoSliderRange(settings.settings.practice.tempoStep))

/** The name as typed; follows the bookmark (an automatic name changes) unless being typed in. */
const name = ref(props.bookmark.name)
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
const fromText = ref('')
const toText = ref('')

watch(
  () => props.bookmark.name,
  (next) => {
    if (document.activeElement !== nameInput.value) name.value = next
  },
)
watch(
  () => props.bookmark.id,
  () => {
    name.value = props.bookmark.name
    syncFields()
  },
)

function typeName(): void {
  // An empty name isn't saved: leaving the field shows the stored one again.
  if (name.value.trim() !== '') emit('edit', { name: name.value })
}

function leaveName(): void {
  name.value = props.bookmark.name
}

/** The save toast's Rename: the cursor in the name, all of it selected. */
function focusName(): void {
  nameInput.value?.focus()
  nameInput.value?.select()
}

defineExpose({ focusName })

const range = computed(() => clampRange(config.value.loop, 1, lastBar.value))
/** A range saved before a meter override shortened the song (decision 67). */
const clamped = computed(() => config.value.loop.endBar > lastBar.value)

function syncFields(): void {
  fromText.value = String(range.value.startBar)
  toText.value = String(range.value.endBar)
}

syncFields()
watch(range, syncFields)

function setConfig(change: Partial<Bookmark['config']>): void {
  emit('edit', { config: { ...config.value, ...change } })
}

function changeRange(edit: { start: number } | { end: number }): void {
  const next = adjustLoopRange(
    { start: range.value.startBar, end: range.value.endBar },
    edit,
    1,
    lastBar.value,
  )
  setConfig({ loop: { startBar: next.start, endBar: next.end } })
  syncFields()
}

function commit(end: 'start' | 'end'): void {
  const typed = Number.parseInt(end === 'start' ? fromText.value : toText.value, 10)
  if (Number.isNaN(typed)) syncFields()
  else changeRange(end === 'start' ? { start: typed } : { end: typed })
}

function setHand(hand: 'right' | 'left', mode: HandAudio): void {
  setConfig({ handAudio: { ...config.value.handAudio, [hand]: mode } })
}

const HAND_OPTIONS = [
  { value: 'on', label: 'On' },
  { value: 'muted', label: 'Mute' },
  { value: 'solo', label: 'Solo' },
] as const
const METRONOME_MODES = [
  { value: 'off', label: 'Off' },
  { value: 'preRoll', label: 'Pre-roll' },
  { value: 'always', label: 'Always' },
] as const
const PRE_ROLL_MODES = [
  { value: 'muted', label: 'Muted' },
  { value: 'quiet', label: 'Quiet' },
] as const

const rangeIsDefault = computed(
  () =>
    range.value.startBar === defaults.value.loop.startBar &&
    range.value.endBar === defaults.value.loop.endBar,
)
const preRollText = computed(() => {
  const beats = config.value.preRollBeats
  if (beats === 0) return 'None'
  return `${beats} ${beats === 1 ? 'beat' : 'beats'} before bar ${range.value.startBar}`
})

const totals = computed(() => stats.entry(props.bookmark.id))
const statItems = computed(() => [
  { label: 'Played', value: formatPlayedTimes(totals.value.plays), testid: 'manager-played' },
  {
    label: 'Practice',
    value: formatPracticeTime(totals.value.playedMs),
    testid: 'manager-practice',
  },
  {
    label: 'Last',
    value: formatLastPracticed(totals.value.lastPlayedAt, stats.now),
    testid: 'manager-last',
  },
])
const chart = computed(() => stats.chart({ entryId: props.bookmark.id }))
</script>

<template>
  <aside class="edit" aria-label="Bookmark" data-testid="bookmark-panel">
    <div class="scroll">
      <p v-if="duplicateOf !== null" class="note" data-testid="bookmark-duplicate-note">
        Duplicate of “{{ duplicateOf }}” · change something to keep it
      </p>
      <p v-if="sameAs !== null" class="note" data-testid="bookmark-same-note">
        Same settings as “{{ sameAs }}”
      </p>
      <div class="field">
        <div class="head">
          <label class="field-label" for="bookmark-name">Name</label>
          <ResetButton
            class="name-reset"
            :changed="!bookmark.autoName"
            setting-label="Name"
            data-testid="bookmark-name-reset"
            @reset="emit('edit', { autoName: true })"
          />
        </div>
        <input
          id="bookmark-name"
          ref="nameInput"
          v-model="name"
          class="form-control name"
          maxlength="120"
          data-testid="bookmark-name"
          @input="typeName"
          @blur="leaveName"
          @keydown.enter="nameInput?.blur()"
        />
      </div>
      <p class="song" data-testid="bookmark-song">Song: {{ song.title }}</p>

      <div class="block">
        <div class="head">
          <span class="field-label">Bars</span>
          <output class="value" data-testid="bookmark-range">
            {{
              range.startBar === range.endBar
                ? `bar ${range.startBar}`
                : `${range.startBar}–${range.endBar}`
            }}
          </output>
          <ResetButton
            :changed="!rangeIsDefault"
            setting-label="Bars"
            data-testid="bookmark-range-reset"
            @reset="setConfig({ loop: defaults.loop })"
          />
        </div>
        <RangeSliderField
          :start="range.startBar"
          :end="range.endBar"
          :min="1"
          :max="lastBar"
          :labels="['Start bar', 'End bar']"
          :value-texts="[`Bar ${range.startBar}`, `Bar ${range.endBar}`]"
          data-testid="bookmark-slider"
          @change="changeRange"
        />
        <div class="fields">
          <label>
            <span class="field-label">From bar</span>
            <input
              v-model="fromText"
              class="form-control"
              type="number"
              inputmode="numeric"
              min="1"
              :max="lastBar"
              data-testid="bookmark-from"
              @change="commit('start')"
              @keydown.enter.prevent="commit('start')"
            />
          </label>
          <label>
            <span class="field-label">To bar</span>
            <input
              v-model="toText"
              class="form-control"
              type="number"
              inputmode="numeric"
              min="1"
              :max="lastBar"
              data-testid="bookmark-to"
              @change="commit('end')"
              @keydown.enter.prevent="commit('end')"
            />
          </label>
        </div>
        <p v-if="clamped" class="hint" data-testid="bookmark-clamped">
          Saved as bars {{ config.loop.startBar }}–{{ config.loop.endBar }}, beyond the song's last
          bar ({{ lastBar }}); it plays to bar {{ lastBar }}.
        </p>
      </div>

      <div class="block">
        <div class="head">
          <span class="field-label">Tempo</span>
          <output class="value" data-testid="bookmark-tempo-value"
            >{{ config.tempoPercent }}%</output
          >
          <ResetButton
            :changed="config.tempoPercent !== defaults.tempoPercent"
            setting-label="Tempo"
            data-testid="bookmark-tempo-reset"
            @reset="setConfig({ tempoPercent: defaults.tempoPercent })"
          />
        </div>
        <SliderField
          :model-value="config.tempoPercent"
          :min="tempoSlider.min"
          :max="tempoSlider.max"
          :step="tempoSlider.step"
          label="Tempo percent"
          :value-text="`${config.tempoPercent}%`"
          data-testid="bookmark-tempo"
          @update:model-value="setConfig({ tempoPercent: $event })"
        />
      </div>

      <div class="hands">
        <div v-for="hand in ['right', 'left'] as const" :key="hand" class="hand">
          <span class="field-label hand-label">{{
            hand === 'right' ? 'Right hand' : 'Left hand'
          }}</span>
          <SegmentedControl
            :model-value="config.handAudio[hand]"
            :options="HAND_OPTIONS"
            :label="hand === 'right' ? 'Right hand' : 'Left hand'"
            :data-testid="`bookmark-${hand}`"
            @update:model-value="setHand(hand, $event)"
          />
          <ResetButton
            :changed="config.handAudio[hand] !== 'on'"
            :setting-label="hand === 'right' ? 'Right hand' : 'Left hand'"
            :data-testid="`bookmark-${hand}-reset`"
            @reset="setHand(hand, 'on')"
          />
        </div>
      </div>

      <div class="block">
        <div class="head">
          <span class="field-label">Pre-roll</span>
          <output class="value" data-testid="bookmark-preroll-value">{{ preRollText }}</output>
          <ResetButton
            :changed="config.preRollBeats !== defaults.preRollBeats"
            setting-label="Pre-roll"
            data-testid="bookmark-preroll-reset"
            @reset="setConfig({ preRollBeats: defaults.preRollBeats })"
          />
        </div>
        <SliderField
          :model-value="config.preRollBeats"
          :min="0"
          :max="16"
          :step="1"
          label="Pre-roll beats"
          :value-text="preRollText"
          inverted
          :end-label="`bar ${range.startBar}`"
          data-testid="bookmark-preroll"
          @update:model-value="setConfig({ preRollBeats: $event })"
        />
        <div class="head mode">
          <SegmentedControl
            :model-value="config.preRollMode"
            :options="PRE_ROLL_MODES"
            label="Pre-roll sound"
            data-testid="bookmark-preroll-mode"
            @update:model-value="setConfig({ preRollMode: $event as PreRollMode })"
          />
          <ResetButton
            :changed="config.preRollMode !== defaults.preRollMode"
            setting-label="Pre-roll sound"
            data-testid="bookmark-preroll-mode-reset"
            @reset="setConfig({ preRollMode: defaults.preRollMode })"
          />
        </div>
      </div>

      <div class="hand">
        <span class="field-label hand-label">Metronome</span>
        <SegmentedControl
          :model-value="config.metronomeMode"
          :options="METRONOME_MODES"
          label="Metronome"
          data-testid="bookmark-metronome"
          @update:model-value="setConfig({ metronomeMode: $event as MetronomeMode })"
        />
        <ResetButton
          :changed="config.metronomeMode !== defaults.metronomeMode"
          setting-label="Metronome"
          data-testid="bookmark-metronome-reset"
          @reset="setConfig({ metronomeMode: defaults.metronomeMode })"
        />
      </div>

      <hr class="divider" />
      <StatsTriple :items="statItems" />
      <PracticeChart
        :minutes="chart"
        :height="44"
        :gap="4"
        :label="`${bookmark.name}, practice per day`"
        data-testid="manager-chart"
      />
    </div>

    <footer class="actions">
      <AppButton variant="primary" class="load" data-testid="bookmark-load" @click="emit('load')">
        Load in player
      </AppButton>
      <AppButton :disabled="isDraft" data-testid="bookmark-duplicate" @click="emit('duplicate')"
        >Duplicate</AppButton
      >
      <AppButton danger data-testid="bookmark-delete" @click="emit('delete')">Delete</AppButton>
    </footer>
  </aside>
</template>

<style scoped>
.edit {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 360px;
  min-height: 0;
  border-left: 1px solid var(--divider);
}

.scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 16px 18px;
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  color: var(--text-3);
  font-size: var(--text-xs);
}

.name {
  height: 38px;
  font-size: 15px;
}

.song {
  margin: 0;
  color: var(--text-2);
  font-size: var(--text-sm);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.head .value {
  margin-left: auto;
  color: var(--text-2);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.mode {
  justify-content: space-between;
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hands {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hand {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
}

.hint {
  margin: 0;
  color: var(--text-3);
  font-size: var(--text-xs);
  line-height: 1.45;
}

.note {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: rgb(var(--primary-rgb) / 12%);
  color: var(--text-1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.name-reset {
  margin-left: auto;
}

.divider {
  width: 100%;
  margin: 2px 0;
  border: 0;
  border-top: 1px solid var(--divider);
}

.actions {
  display: flex;
  gap: var(--space-2);
  padding: 14px 18px 18px;
  border-top: 1px solid var(--divider);
}

.load {
  flex: 1;
}
</style>
