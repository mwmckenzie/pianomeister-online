<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
  type RouteLocationRaw,
} from 'vue-router'

import { applyFlips } from '@/core/hands/applyFlips'
import { confidencePercent } from '@/core/hands/confidencePercent'
import { flipNote } from '@/core/hands/flipNote'
import type { HandLetter } from '@/core/hands/HandLetter'
import type { HandReview } from '@/core/hands/HandReview'
import { handsHash } from '@/core/hands/handsHash'
import type { HandSettings, VoiceRole } from '@/core/hands/HandSettings'
import { setSplitParam } from '@/core/hands/setSplitParam'
import { SPLIT_ALGORITHMS, splitAlgorithm } from '@/core/hands/SPLIT_ALGORITHMS'
import { voiceLabel } from '@/core/hands/voiceLabel'
import { voiceNote } from '@/core/hands/voiceNote'
import { noteName } from '@/core/noteName'
import { clampView } from '@/core/overview/clampView'
import { layoutBars } from '@/core/overview/layoutBars'
import type { OverviewView } from '@/core/overview/OverviewView'
import { viewForBars } from '@/core/overview/viewForBars'
import { zoomAround } from '@/core/overview/zoomAround'
import { BarMap } from '@/core/timing/BarMap'
import type { HandDetails } from '@/data/HandDetails'
import type { OpenedSong } from '@/data/OpenedSong'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import AppIcon from '../components/AppIcon.vue'
import SelectField from '../components/SelectField.vue'
import SliderField from '../components/SliderField.vue'
import { channelColor } from '../hands/channelColor'
import { handColors } from '../hands/handColors'
import HandRoll from '../hands/HandRoll.vue'
import { VOICE_ROLES } from '../hands/VOICE_ROLES'
import { useElementSize } from '../overview/useElementSize'
import { sceneSnapshot } from '../playback/sceneSnapshot'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * Review hands (`#/hands/⟨song⟩`, milestone 10.5): the song's voices, split method and every
 * note's hand, edited as a draft that Save makes the profile's own.
 */
const route = useRoute()
const router = useRouter()
const store = useLibraryStore()
const settings = useSettingsStore()

const songId = computed(() => String(route.params.songId))
const opened = shallowRef<OpenedSong | null>(null)
const details = shallowRef<HandDetails | null>(null)
const error = ref('')
/** Plain data, replaced whole. */
const draft = shallowRef<HandSettings | null>(null)
const saved = shallowRef<HandSettings | null>(null)
const review = shallowRef<HandReview | null>(null)
const compare = ref('none')
const compared = shallowRef<HandReview | null>(null)
const advanced = ref(false)
const busy = ref(false)

async function load(): Promise<void> {
  const id = songId.value
  error.value = ''
  draft.value = null
  saved.value = null
  review.value = null
  compare.value = 'none'
  opened.value = null
  try {
    if (!store.loaded) await store.refresh()
    const [song, hands] = await Promise.all([store.openSong(id), store.handDetails(id)])
    if (id !== songId.value) return
    opened.value = song
    details.value = hands
    saved.value = hands.settings
    draft.value = hands.settings
    view.value = viewForBars(layoutBars(barMapOf(song)), 8, 0)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    console.error("[hands] Couldn't open the song:", e)
  }
}
watch(songId, () => void load(), { immediate: true })

const dirty = computed(
  () =>
    draft.value !== null &&
    saved.value !== null &&
    handsHash(draft.value) !== handsHash(saved.value),
)
function edit(change: Partial<HandSettings>): void {
  if (draft.value !== null) draft.value = { ...draft.value, ...change }
}

// ---- Splitting (in the worker; a slider drag runs it again, the last value wins) -------------

/** What a split depends on: not the flips. */
const splitKey = computed(() =>
  draft.value === null ? '' : `${songId.value} ${handsHash({ ...draft.value, flips: {} })}`,
)

/** Runs `job` on each change of `key`, one at a time, skipping to the latest. */
function latest(key: () => string, job: () => Promise<void>): void {
  let running = false
  let again = false
  async function run(): Promise<void> {
    if (running) {
      again = true
      return
    }
    running = true
    do {
      again = false
      try {
        await job()
      } catch (e) {
        error.value = `Couldn't split the hands: ${e instanceof Error ? e.message : String(e)}`
        console.error('[hands]', e)
      }
    } while (again)
    running = false
  }
  watch(key, () => void run(), { immediate: true })
}
latest(
  () => splitKey.value,
  async () => {
    const id = songId.value
    if (draft.value === null) return
    const result = await store.reviewHands(id, draft.value)
    if (id === songId.value) review.value = result
  },
)
latest(
  () => `${compare.value} ${splitKey.value}`,
  async () => {
    if (draft.value === null || compare.value === 'none') {
      compared.value = null
      return
    }
    const method = compare.value
    const result = await store.reviewHands(songId.value, {
      ...draft.value,
      algorithm: method,
      params: {},
    })
    if (method === compare.value) compared.value = result
  },
)

// ---- Every note's hand ------------------------------------------------------------------------

const barMapOf = (song: OpenedSong) => BarMap.fromSong(song.song, song.override)
const barMap = computed(() => (opened.value === null ? null : barMapOf(opened.value)))
const layout = computed(() => (barMap.value === null ? null : layoutBars(barMap.value)))
const notes = computed(() => opened.value?.song.notes ?? [])
const noteIds = computed(() => opened.value?.song.noteIds ?? [])
/** A note's place in the hands strings. */
const placeOf = computed(() => new Map(noteIds.value.map((id, i) => [id, i])))
const computedHands = computed(() => review.value?.computed ?? '')
const finalHands = computed(() =>
  applyFlips(noteIds.value, computedHands.value, draft.value?.flips ?? {}),
)
const handOf = (hands: string, id: string) => hands[placeOf.value.get(id) ?? -1] ?? '-'

const colors = computed(() => handColors(settings.settings.handCages))
const channelColors = computed(() => notes.value.map((n) => channelColor(n.channel)))
const noteColors = computed(() =>
  notes.value.map((n) => {
    const hand = handOf(finalHands.value, n.id)
    return hand === 'R' ? colors.value.right : hand === 'L' ? colors.value.left : null
  }),
)
const flipped = computed(
  () =>
    new Set(
      Object.keys(draft.value?.flips ?? {}).filter((id) => {
        const hand = handOf(computedHands.value, id)
        return hand !== '-'
      }),
    ),
)
const uncertain = computed(
  () => new Set((review.value?.uncertain ?? []).filter((id) => !flipped.value.has(id))),
)
const differs = computed(() => {
  const other = compared.value?.computed
  if (other === undefined || other.length !== finalHands.value.length) return new Set<string>()
  return new Set(noteIds.value.filter((_, i) => other[i] !== finalHands.value[i]))
})
const counts = computed(() => {
  let right = 0
  let left = 0
  for (const h of finalHands.value) {
    if (h === 'R') right++
    else if (h === 'L') left++
  }
  return { right, left }
})

function flip(index: number): void {
  const note = notes.value[index]
  if (note === undefined || draft.value === null) return
  const hand = handOf(computedHands.value, note.id)
  if (hand === '-') return
  edit({ flips: flipNote(draft.value.flips, note.id, hand as HandLetter) })
}

function describe(index: number): string {
  const note = notes.value[index]
  if (note === undefined || barMap.value === null) return ''
  const { bar, beat } = barMap.value.tickToPosition(note.startTick)
  const hand = handOf(finalHands.value, note.id) === 'R' ? 'right' : 'left'
  const extra = flipped.value.has(note.id)
    ? ', flipped by you'
    : uncertain.value.has(note.id)
      ? ', uncertain'
      : ''
  return `${noteName(note.midi)}, bar ${bar} beat ${beat}: ${hand} hand${extra}. Click to flip.`
}

// ---- The panel ----------------------------------------------------------------------------

const roleOf = (voice: string): VoiceRole => draft.value?.roles[voice] ?? 'hidden'
const guessOf = (voice: string) => details.value?.guesses.find((g) => g.voiceId === voice)
const method = computed(() => splitAlgorithm(draft.value?.algorithm ?? ''))
const METHODS = SPLIT_ALGORITHMS.map((a, i) => ({
  value: a.id,
  label: i === 0 ? `${a.name} (recommended)` : a.name,
}))
const compareOptions = computed(() => [
  { value: 'none', label: 'Nothing' },
  ...SPLIT_ALGORITHMS.filter((a) => a.id !== method.value.id).map((a) => ({
    value: a.id,
    label: a.name,
  })),
])
const compareText = computed(() => {
  const n = differs.value.size
  return compare.value === 'none' || compared.value === null
    ? ''
    : `${splitAlgorithm(compare.value).name} differs on ${count(n, 'note')} (dashed)`
})

function count(n: number, what: string): string {
  return `${n} ${n === 1 ? what : `${what}s`}`
}

function setMethod(id: string): void {
  // Each method has its own parameters.
  edit({ algorithm: id, params: {} })
  if (compare.value === id) compare.value = 'none'
}
const paramValue = (key: string) =>
  draft.value?.params[key] ?? method.value.params.find((p) => p.key === key)?.default ?? 0
function paramText(type: 'number' | 'note', key: string): string {
  const value = paramValue(key)
  return type === 'note' ? noteName(value) : String(Number(value.toFixed(5)))
}

/** Back to what detection gave; saved only by Save. Detects first a song that never was. */
async function resetToDetected(): Promise<void> {
  if (details.value?.detected === null) {
    busy.value = true
    const ok = await store.detectHands(songId.value)
    if (ok) details.value = await store.handDetails(songId.value)
    else error.value = store.error
    busy.value = false
  }
  const detected = details.value?.detected
  if (detected == null) return
  draft.value = {
    roles: detected.roles,
    algorithm: settings.settings.hands.defaultAlgorithm,
    params: {},
    flips: {},
  }
  compare.value = 'none'
}

/** The save in progress: leaving waits for it instead of asking about changes being saved. */
let saving: Promise<void> | null = null
async function save(): Promise<void> {
  saving = saveDraft()
  await saving
  saving = null
}

async function saveDraft(): Promise<void> {
  const next = draft.value
  if (next === null) return
  busy.value = true
  if (await store.setHands(songId.value, next)) {
    saved.value = next
    error.value = ''
  } else error.value = store.error
  busy.value = false
}

// ---- Time axis ------------------------------------------------------------------------------

const view = ref<OverviewView>({ startTick: 0, span: 1 })
function zoom(factor: number): void {
  if (layout.value === null) return
  const middle = view.value.startTick + view.value.span / 2
  view.value = zoomAround(view.value, factor, middle, layout.value)
}

/** A native scrollbar for the time axis: the inner width is the song at this zoom. */
const scroller = useTemplateRef<HTMLElement>('scroller')
const scrollerSize = useElementSize(scroller)
const total = computed(() =>
  layout.value === null ? 1 : layout.value.endTick - layout.value.startTick,
)
const innerWidth = computed(() => (scrollerSize.value.width * total.value) / view.value.span)
const pxPerTick = computed(() => scrollerSize.value.width / view.value.span)
watch(
  [view, innerWidth],
  () => {
    const el = scroller.value
    if (el === null || layout.value === null) return
    const left = (view.value.startTick - layout.value.startTick) * pxPerTick.value
    if (Math.abs(el.scrollLeft - left) > 1) el.scrollLeft = left
  },
  { flush: 'post' },
)
function onScroll(): void {
  const el = scroller.value
  if (el === null || layout.value === null || pxPerTick.value === 0) return
  const startTick = layout.value.startTick + el.scrollLeft / pxPerTick.value
  if (Math.abs(startTick - view.value.startTick) * pxPerTick.value <= 1) return
  view.value = clampView({ startTick, span: view.value.span }, layout.value)
}

// ---- Leaving ----------------------------------------------------------------------------------

const asking = ref(false)
let destination: RouteLocationRaw | null = null
let leaving = false
async function guard(to: { readonly fullPath: string }): Promise<boolean> {
  await saving
  if (leaving || !dirty.value) return true
  destination = to.fullPath
  asking.value = true
  return false
}
onBeforeRouteLeave(guard)
onBeforeRouteUpdate(guard)

function back(): void {
  void router.push({ name: 'library', query: { song: songId.value } })
}

async function discard(): Promise<void> {
  asking.value = false
  if (destination === null) return
  leaving = true
  await router.push(destination)
  leaving = false
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  // Esc belongs to an open dialog or list first.
  if (
    document.querySelector(
      '[role="dialog"][data-state="open"], [data-reka-popper-content-wrapper] > [data-state="open"]',
    ) !== null
  )
    return
  event.preventDefault()
  back()
}
// Captured: by the bubble phase a dialog has already closed on this Esc, and would be asked again.
onMounted(() => window.addEventListener('keydown', onKeyDown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown, true))

/** A reload or closed tab with unsaved changes: the browser asks "Leave site?". */
function onBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault()
}
watch(
  dirty,
  (is) => {
    if (is) window.addEventListener('beforeunload', onBeforeUnload)
    else window.removeEventListener('beforeunload', onBeforeUnload)
  },
  // At once: Save followed by a reload must not ask.
  { flush: 'sync' },
)
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

const backdrop = computed(() =>
  sceneSnapshot.value === null ? undefined : { backgroundImage: `url(${sceneSnapshot.value})` },
)
const subtitle = computed(() =>
  [opened.value?.entry.title, opened.value?.entry.composer]
    .filter((t) => t !== undefined && t !== '')
    .join(' · '),
)
</script>

<template>
  <main class="review-page" data-testid="review-hands">
    <div class="backdrop" :class="{ snapshot: backdrop }" :style="backdrop" />
    <div class="window glass">
      <header class="top">
        <button type="button" class="back" data-testid="review-back" @click="back">
          <AppIcon name="chevronLeft" :size="18" /> Library
        </button>
        <div class="titles">
          <h1>Review hands</h1>
          <p data-testid="review-song">{{ subtitle }}</p>
        </div>
        <span class="spacer" />
        <span v-if="dirty" class="dim" data-testid="review-dirty">Unsaved changes</span>
        <AppButton :disabled="busy || !draft" data-testid="review-reset" @click="resetToDetected">
          Reset to detected
        </AppButton>
        <AppButton
          variant="primary"
          :disabled="busy || !draft"
          data-testid="review-save"
          @click="save"
        >
          Save
        </AppButton>
      </header>
      <p v-if="error" class="error" role="alert" data-testid="review-error">{{ error }}</p>

      <div v-if="draft && details && layout" class="body">
        <aside class="panel" aria-label="Detection">
          <section class="group">
            <h2 class="section-caps">Voices</h2>
            <div v-for="v in details.voices" :key="v.id" class="card">
              <div class="voice">
                <span class="voice-text">
                  <span class="voice-name" :title="voiceLabel(v)">{{ voiceLabel(v) }}</span>
                  <span class="voice-note">
                    {{ voiceNote(v, guessOf(v.id))
                    }}<template v-if="guessOf(v.id)">
                      · {{ confidencePercent(guessOf(v.id)?.confidence ?? 0) }} %</template
                    >
                  </span>
                </span>
                <SelectField
                  class="compact"
                  :model-value="roleOf(v.id)"
                  :options="VOICE_ROLES"
                  :label="`${voiceLabel(v)} hand`"
                  :data-testid="`review-voice-${v.id}`"
                  @update:model-value="edit({ roles: { ...draft.roles, [v.id]: $event } })"
                />
              </div>
              <p v-if="guessOf(v.id)?.reasons[0]" class="reason">
                {{ guessOf(v.id)?.reasons[0] }}
              </p>
            </div>
          </section>

          <section class="group">
            <h2 class="section-caps">Split method</h2>
            <SelectField
              class="method-select"
              :model-value="method.id"
              :options="METHODS"
              label="Split method"
              data-testid="review-method"
              @update:model-value="setMethod"
            />
            <button
              type="button"
              class="disclosure"
              :aria-expanded="advanced"
              data-testid="review-advanced"
              @click="advanced = !advanced"
            >
              <AppIcon name="chevronRight" :size="12" :class="{ open: advanced }" /> Advanced
            </button>
            <div v-if="advanced" class="card params">
              <div v-for="p in method.params" :key="`${method.id}-${p.key}`" :title="p.help">
                <span class="param-head">
                  {{ p.label }}
                  <span class="value" :data-testid="`review-value-${p.key}`">{{
                    paramText(p.type, p.key)
                  }}</span>
                </span>
                <SliderField
                  :model-value="paramValue(p.key)"
                  :min="p.min"
                  :max="p.max"
                  :step="p.step"
                  :label="p.label"
                  :value-text="paramText(p.type, p.key)"
                  :data-testid="`review-param-${p.key}`"
                  @update:model-value="
                    edit({ params: setSplitParam(method, draft.params, p.key, $event) })
                  "
                />
              </div>
              <AppButton
                variant="text"
                size="sm"
                :disabled="Object.keys(draft.params).length === 0"
                data-testid="review-reset-params"
                @click="edit({ params: {} })"
              >
                Reset these
              </AppButton>
            </div>
          </section>

          <section class="group" data-testid="review-result">
            <h2 class="section-caps">Result</h2>
            <div class="bar" aria-hidden="true">
              <span :style="{ flex: counts.right, background: colors.right }" />
              <span :style="{ flex: counts.left, background: colors.left }" />
            </div>
            <p class="counts" data-testid="review-counts">
              <span>Right {{ count(counts.right, 'note') }}</span>
              <span class="visually-hidden"> · </span>
              <span>Left {{ count(counts.left, 'note') }}</span>
            </p>
            <p class="dim" data-testid="review-flips">
              {{ flipped.size === 0 ? 'No flips' : `${count(flipped.size, 'note')} flipped` }} ·
              {{ uncertain.size }} uncertain
            </p>
          </section>
          <p class="foot">
            Saved with the song; the MIDI file is unchanged until you export with hands split.
          </p>
        </aside>

        <section class="work" aria-label="Notes">
          <div class="tools">
            <span class="legend"><i :style="{ background: colors.right }" />Right</span>
            <span class="legend"><i :style="{ background: colors.left }" />Left</span>
            <span class="legend"><i class="flip" />Flipped by you</span>
            <span class="legend"
              ><i class="stripes" :style="{ '--stripe': colors.right }" />Uncertain</span
            >
            <span class="spacer" />
            <span class="compare">
              Compare with
              <SelectField
                v-model="compare"
                class="compact"
                :options="compareOptions"
                label="Compare with"
                data-testid="review-compare"
              />
            </span>
            <AppButton
              size="sm"
              :disabled="Object.keys(draft.flips).length === 0"
              data-testid="review-clear"
              @click="edit({ flips: {} })"
            >
              Clear flips
            </AppButton>
            <span class="zoom">
              <AppButton
                size="sm"
                aria-label="Zoom out"
                data-testid="review-zoom-out"
                @click="zoom(1.5)"
                >−</AppButton
              >
              <AppButton
                size="sm"
                aria-label="Zoom in"
                data-testid="review-zoom-in"
                @click="zoom(1 / 1.5)"
                >+</AppButton
              >
            </span>
          </div>

          <p class="lane-title">Current · by channel</p>
          <HandRoll
            class="current"
            :notes="notes"
            :layout="layout"
            :view="view"
            :colors="channelColors"
            label="Current notes, coloured by channel"
            data-testid="review-current"
            @view="view = $event"
          />
          <p class="lane-title">
            <span>Proposed · {{ method.name }} — click a note to flip it</span>
            <span data-testid="review-compare-text">{{ compareText }}</span>
          </p>
          <HandRoll
            class="proposed"
            :notes="notes"
            :layout="layout"
            :view="view"
            :colors="noteColors"
            :flipped="flipped"
            :uncertain="uncertain"
            :differs="differs"
            :describe="describe"
            label="Proposed hands. Arrow keys move between notes, Enter flips."
            data-testid="review-proposed"
            @view="view = $event"
            @flip="flip"
          />
          <div
            ref="scroller"
            class="scroller"
            tabindex="-1"
            data-testid="review-scroller"
            @scroll="onScroll"
          >
            <div :style="{ width: `${innerWidth}px` }" />
          </div>
        </section>
      </div>
    </div>

    <AppDialog v-model:open="asking" title="Discard changes?" show-title width="420px">
      <p class="dialog-text">Your changes to this song's hands aren't saved.</p>
      <template #footer>
        <AppButton data-testid="review-keep" @click="asking = false">Keep editing</AppButton>
        <AppButton danger data-testid="review-discard" @click="discard">Discard</AppButton>
      </template>
    </AppDialog>
  </main>
</template>

<style scoped>
.review-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--bg);
}

.backdrop {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #05070f, #0a0f1e);
}

.backdrop.snapshot {
  inset: -32px;
  background-position: center;
  background-size: cover;
  filter: blur(12px);
}

.backdrop::after {
  position: absolute;
  inset: 0;
  background: rgb(5 7 15 / 78%);
  content: '';
}

.window {
  position: absolute;
  inset: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-lg);
  --glass-alpha: 0.6;
}

.top,
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.top {
  padding: 14px 18px;
  border-bottom: 1px solid var(--divider);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px 0 10px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--field);
  color: var(--text-1);
  font-size: var(--text-md);
  cursor: pointer;
}

.titles {
  min-width: 0;
}

.titles h1,
.titles p,
.group h2,
.reason,
.counts,
.foot,
.dim,
.lane-title {
  margin: 0;
}

.titles h1 {
  font-size: 18px;
  font-weight: var(--weight-medium);
}

.titles p,
.dim {
  color: var(--text-3);
  font-size: var(--text-sm);
}

.spacer {
  flex: 1;
}

.error {
  margin: 0;
  padding: var(--space-2) 18px;
  color: var(--danger);
  font-size: var(--text-sm);
}

.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 16px;
  width: 280px;
  padding: 16px;
  overflow-y: auto;
  border-right: 1px solid var(--divider);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-caps {
  color: var(--text-4);
}

.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgb(255 255 255 / 5%);
}

.voice,
.counts,
.param-head,
.lane-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.voice-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.voice-name {
  font-size: var(--text-md);
  line-height: 1.3;
}

.voice-note,
.foot,
.lane-title {
  color: var(--text-4);
  font-size: var(--text-xs);
}

.reason {
  color: var(--text-3);
  font-size: var(--text-xs);
  line-height: 1.45;
}

.disclosure {
  display: flex;
  gap: 4px;
  align-items: center;
  align-self: flex-start;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--text-3);
  font-size: var(--text-sm);
  cursor: pointer;
}

.disclosure .open {
  transform: rotate(90deg);
}

.param-head,
.counts {
  color: var(--text-2);
  font-size: var(--text-sm);
}

.value {
  color: var(--text-strong);
}

.bar {
  display: flex;
  gap: 2px;
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius-full);
}

.foot {
  margin-top: auto;
  line-height: 1.5;
}

.work {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px 18px 14px;
}

.legend,
.compare {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
  font-size: var(--text-sm);
}

.legend i {
  width: 12px;
  height: 8px;
  border-radius: 3px;
}

.legend .flip {
  border: 1.5px solid #fff;
}

.legend .stripes {
  background: repeating-linear-gradient(
    135deg,
    var(--stripe) 0 2px,
    color-mix(in srgb, var(--stripe) 35%, transparent) 2px 4px
  );
}

.zoom {
  display: flex;
  gap: 6px;
}

.method-select {
  text-align: left;
}

.current {
  flex-shrink: 0;
  height: 92px;
}

.proposed {
  flex: 1;
  min-height: 120px;
}

.scroller {
  flex-shrink: 0;
  height: 14px;
  overflow-x: auto;
  overflow-y: hidden;
}

.scroller > div {
  height: 1px;
}
</style>
