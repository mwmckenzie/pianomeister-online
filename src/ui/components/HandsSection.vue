<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { confidencePercent } from '@/core/hands/confidencePercent'
import { needsHandsCheck } from '@/core/hands/needsHandsCheck'
import type { VoiceRole } from '@/core/hands/HandSettings'
import { splitAlgorithm } from '@/core/hands/SPLIT_ALGORITHMS'
import type { SongHands } from '@/core/hands/SongHands'
import { voiceLabel } from '@/core/hands/voiceLabel'
import { voiceNote } from '@/core/hands/voiceNote'
import type { HandDetails } from '@/data/HandDetails'

import ExportSplitDialog from '../hands/ExportSplitDialog.vue'
import { handColors } from '../hands/handColors'
import { VOICE_ROLES } from '../hands/VOICE_ROLES'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'
import SelectField from './SelectField.vue'

/** The Library details' "Hands" (milestone 10.5): a role per voice, the split and its reasons. */
const props = defineProps<{ readonly songId: string; readonly hands: SongHands }>()

const router = useRouter()
const store = useLibraryStore()
const settings = useSettingsStore()

const details = shallowRef<HandDetails | null>(null)
const busy = ref(false)
const whyOpen = ref(false)
const exporting = ref(false)
/** Bumped after a failed save to re-render the pickers from the stored roles. */
const revision = ref(0)

let loads = 0
async function load(): Promise<void> {
  const mine = ++loads
  try {
    const loaded = await store.handDetails(props.songId)
    if (mine === loads) details.value = loaded
  } catch (e) {
    if (mine === loads) store.reportError("read the song's hands", e)
  }
}

watch(
  () => props.songId,
  () => {
    details.value = null
    whyOpen.value = false
  },
)
// Detection (an upload's, the background pass's) changes the entry's hands: show it at once.
watch(
  () => [props.songId, props.hands.source, props.hands.confidence, props.hands.summary] as const,
  () => void load(),
  { immediate: true },
)

const roleOf = (voice: string): VoiceRole => details.value?.settings.roles[voice] ?? 'hidden'

/** A role change applies at once and makes the hands the player's own. */
async function setRole(voice: string, role: VoiceRole): Promise<void> {
  const current = details.value
  if (current === null || busy.value || roleOf(voice) === role) return
  busy.value = true
  const next = { ...current.settings, roles: { ...current.settings.roles, [voice]: role } }
  const saved = await store.setHands(props.songId, next)
  if (saved) await load()
  else revision.value++
  busy.value = false
}

async function detect(): Promise<void> {
  busy.value = true
  await store.detectHands(props.songId)
  busy.value = false
}

const badge = computed(() => {
  const { source, confidence } = props.hands
  if (source === 'user') return { kind: 'edited', text: 'Edited' }
  if (source === 'default') return { kind: 'edited', text: 'Not detected' }
  const percent = confidence === null ? '' : ` · ${confidencePercent(confidence)} %`
  return needsHandsCheck(props.hands, settings.settings.hands.hintBelow)
    ? { kind: 'check', text: `Check${percent}` }
    : { kind: 'detected', text: `Detected${percent}` }
})
const guessOf = (voice: string) => details.value?.guesses.find((g) => g.voiceId === voice)
const isSplit = computed(() => details.value?.voices.some((v) => roleOf(v.id) === 'split') ?? false)
const allHidden = computed(
  () => details.value !== null && details.value.voices.every((v) => roleOf(v.id) === 'hidden'),
)
const method = computed(() => splitAlgorithm(details.value?.settings.algorithm ?? '').name)
const colors = computed(() => handColors(settings.settings.handCages))
const reasons = computed(() => {
  const voices = details.value?.voices ?? []
  return voices.flatMap((v) =>
    (guessOf(v.id)?.reasons ?? []).map((r) => (voices.length > 1 ? `${voiceLabel(v)}: ${r}` : r)),
  )
})
const notes = (n: number) => `${n} ${n === 1 ? 'note' : 'notes'}`
</script>

<template>
  <section class="hands" aria-label="Hands" data-testid="hands-section">
    <header class="hands-head">
      <h3 class="section-caps">Hands</h3>
      <span class="badge" :class="badge.kind" data-testid="hands-badge">{{ badge.text }}</span>
    </header>

    <template v-if="details">
      <div v-for="v in details.voices" :key="`${v.id}-${revision}`" class="voice">
        <span class="voice-text">
          <span class="voice-name" :title="voiceLabel(v)">{{ voiceLabel(v) }}</span>
          <span class="voice-note">{{ voiceNote(v, guessOf(v.id)) }}</span>
        </span>
        <SelectField
          class="compact"
          :model-value="roleOf(v.id)"
          :options="VOICE_ROLES"
          :disabled="busy"
          :label="`${voiceLabel(v)} hand`"
          :data-testid="`hand-voice-${v.id}`"
          @update:model-value="setRole(v.id, $event)"
        />
      </div>
      <p v-if="allHidden" class="warning" data-testid="hands-warning">No hand is shown</p>

      <div v-if="isSplit && hands.summary" class="split" data-testid="hands-split">
        <p class="method">
          Split with <strong>{{ method }}</strong>
        </p>
        <div class="bar" aria-hidden="true">
          <span :style="{ flex: hands.summary.right, background: colors.right }" />
          <span :style="{ flex: hands.summary.left, background: colors.left }" />
        </div>
        <p class="counts" data-testid="hands-counts">
          <span>Right {{ notes(hands.summary.right) }}</span>
          <span class="visually-hidden"> · </span>
          <span>Left {{ notes(hands.summary.left) }}</span>
        </p>
        <template v-if="reasons.length > 0">
          <button
            type="button"
            class="why"
            :aria-expanded="whyOpen"
            data-testid="hands-why"
            @click="whyOpen = !whyOpen"
          >
            <AppIcon name="chevronRight" :size="12" :class="{ open: whyOpen }" /> Why
          </button>
          <ul v-if="whyOpen" class="reasons" data-testid="hands-reasons">
            <li v-for="r in reasons" :key="r">{{ r }}</li>
          </ul>
        </template>
      </div>

      <AppButton
        v-if="hands.source === 'default'"
        size="sm"
        :disabled="busy"
        data-testid="hands-detect"
        @click="detect"
      >
        Detect hands
      </AppButton>
      <div class="actions">
        <AppButton
          size="sm"
          data-testid="hands-review"
          @click="router.push({ name: 'hands', params: { songId } })"
        >
          Review hands…
        </AppButton>
        <AppButton size="sm" data-testid="hands-export" @click="exporting = true">
          Export split…
        </AppButton>
      </div>
      <p class="foot">
        Stored with the song; the MIDI file is unchanged. Your own changes are never replaced by
        detection.
      </p>
      <ExportSplitDialog v-model:open="exporting" :song-id="songId" />
    </template>
  </section>
</template>

<style scoped>
.hands {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
}

.hands-head,
.voice,
.counts {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.section-caps,
.method,
.counts,
.warning,
.foot {
  margin: 0;
}

.section-caps {
  color: var(--text-4);
}

.badge {
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background: var(--field);
  color: var(--text-2);
  font-size: var(--text-xs);
}

.badge.detected {
  background: rgb(var(--secondary-rgb) / 14%);
  color: var(--secondary);
}

.badge.check {
  background: rgb(var(--warning-rgb) / 14%);
  color: var(--warning);
}

.actions {
  display: flex;
  gap: 8px;
}

.actions > * {
  flex: 1;
}

.voice-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.voice-name {
  overflow: hidden;
  color: var(--text-soft);
  font-size: var(--text-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-note,
.foot {
  color: var(--text-4);
  font-size: var(--text-xs);
}

.foot {
  line-height: 1.45;
}

.warning {
  color: var(--warning);
  font-size: var(--text-sm);
}

.split {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgb(255 255 255 / 4%);
}

.method {
  color: var(--text-2);
  font-size: var(--text-sm);
}

.method strong {
  color: var(--text-strong);
  font-weight: var(--weight-regular);
}

.bar {
  display: flex;
  gap: 2px;
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius-full);
}

.counts {
  color: var(--text-3);
  font-size: var(--text-xs);
}

.why {
  display: flex;
  gap: 4px;
  align-items: center;
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--text-3);
  font-size: var(--text-sm);
  cursor: pointer;
}

.why .open {
  transform: rotate(90deg);
}

.reasons {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0 0 0 16px;
  color: var(--text-2);
  font-size: var(--text-xs);
  line-height: 1.45;
}
</style>
