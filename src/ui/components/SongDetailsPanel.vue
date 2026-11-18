<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import type { Hand } from '@/core/hands/Hand'
import { defaultHands } from '@/core/hands/defaultHands'
import type { HandAssignment } from '@/core/hands/HandAssignment'
import { allComposers } from '@/core/library/composerSuggestions'
import { formatTempoRange } from '@/core/library/formatTempoRange'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { SongMetaFields } from '@/core/library/SongMetaFields'
import { noteName } from '@/core/noteName'
import { BarMap } from '@/core/timing/BarMap'
import type { MeterOverride } from '@/core/timing/MeterOverride'
import { summariseMeter } from '@/core/timing/summariseMeter'
import type { OpenedSong } from '@/data/OpenedSong'

import { formatTime } from '../format/formatTime'
import { useLibraryStore } from '../stores/libraryStore'
import AppButton from './AppButton.vue'
import ComboboxField from './ComboboxField.vue'
import IconButton from './IconButton.vue'
import MeterOverrideEditor from './MeterOverrideEditor.vue'
import MeterReadout from './MeterReadout.vue'
import SelectField from './SelectField.vue'
import TagEditor from './TagEditor.vue'

const props = defineProps<{ readonly songId: string }>()
const emit = defineEmits<{ close: []; play: []; bookmarks: [] }>()

const store = useLibraryStore()
const entry = computed(() => store.entries.find((e) => e.songId === props.songId) ?? null)

const opened = shallowRef<OpenedSong | null>(null)
const loadError = ref('')
// Shallow: the assignment is replaced whole, never mutated, and stays plain data.
const hands = shallowRef<HandAssignment>({ right: [], left: [] })
const handsAreDefault = ref(true)
/** Bumped after a failed save to re-render the channel selects from the stored assignment. */
const handsRevision = ref(0)
const title = ref('')
const composer = ref('')
const confirmingDelete = ref(false)
/** Deleting an upload keeps its bookmarks and stats unless ticked (decision 74). */
const deletePracticeData = ref(false)
const editingMeter = ref(false)

/** Loads the song and its stored settings; also used to undo a change whose save failed. */
async function load(songId: string): Promise<void> {
  loadError.value = ''
  try {
    const song = await store.openSong(songId)
    if (songId !== props.songId) return
    opened.value = song
    hands.value = song.hands
    handsAreDefault.value = song.defaultHands
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
    console.error("[library] Couldn't open the song:", e)
  }
}

watch(
  () => props.songId,
  (songId) => {
    opened.value = null
    confirmingDelete.value = false
    deletePracticeData.value = false
    editingMeter.value = false
    void load(songId)
  },
  { immediate: true },
)

/**
 * Fills the inputs from the library. Only on opening a song or resetting: saving refreshes the
 * list, and re-syncing then would wipe what the user is typing in the next field.
 */
function syncFields(): void {
  title.value = entry.value?.title ?? ''
  composer.value = entry.value?.composer ?? ''
}

watch(() => props.songId, syncFields, { immediate: true })

async function resetMeta(): Promise<void> {
  if (await store.resetMeta(props.songId)) syncFields()
}

/** "Guess from file" (decision 79): the title and composer guessed afresh, saved as an edit. */
async function guessMeta(): Promise<void> {
  const guess = await store.guessMeta(props.songId)
  if (guess === null) return
  await queueMeta((stored) => ({ ...guess, tags: stored.tags }))
  syncFields()
}

/**
 * Metadata saves run one at a time, and each builds its fields when it runs, from the entry as
 * stored by then: two quick edits (title, then composer) must not race, or the second would
 * send the old title back.
 */
let metaQueue: Promise<void> = Promise.resolve()

function queueMeta(fields: (stored: LibraryEntry) => SongMetaFields): Promise<void> {
  const run = metaQueue.then(async () => {
    const stored = entry.value
    if (stored !== null) await store.setMeta(props.songId, fields(stored))
  })
  metaQueue = run.catch(() => undefined)
  return run
}

/**
 * Saves one text field (on blur, or Enter, which blurs) and waits for the write. Afterwards the
 * field shows what is stored: the saved value (trimmed; an emptied title falls back to the
 * original), or, if the save failed, the previous value while the error is shown.
 */
async function saveField(field: 'title' | 'composer'): Promise<void> {
  const value = field === 'title' ? title.value : composer.value
  const stored = field === 'title' ? entry.value?.title : entry.value?.composer
  // Leaving the composer field after choosing a name commits the same text again.
  if (value.trim() === stored) {
    if (field === 'title') title.value = stored
    else composer.value = stored
    return
  }
  await queueMeta((stored) => ({
    title: field === 'title' ? value : stored.title,
    composer: field === 'composer' ? value : stored.composer,
    tags: stored.tags,
  }))
  if (field === 'title') title.value = entry.value?.title ?? ''
  else composer.value = entry.value?.composer ?? ''
}

function saveTags(tags: readonly string[]): void {
  // The tag chips show the stored tags, so a failed save leaves them as they were.
  void queueMeta((stored) => ({ title: stored.title, composer: stored.composer, tags }))
}

function blurOnEnter(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement) event.target.blur()
}

const composers = computed(() => allComposers(store.entries))
const HAND_OPTIONS = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'hidden', label: 'Hidden' },
] as const
/** The meter as played (override applied): main meter, and its changes when from the file. */
const meter = computed(() => {
  const e = entry.value
  if (e === null) return null
  if (opened.value !== null) return summariseMeter(BarMap.fromSong(opened.value.song, e.override))
  return { main: e.timeSignature, changes: 0, runs: [{ bar: 1, meter: e.timeSignature }] }
})
const meterSource = computed(() => {
  const override = entry.value?.override ?? null
  return override === null
    ? ' from file · bar 1 at tick 0'
    : ` override · bar 1 at tick ${override.barOneStartTick}`
})
const fileBars = computed(() =>
  opened.value === null ? 0 : BarMap.fromSong(opened.value.song, null).barCount,
)

function handOf(channel: number): Hand | 'hidden' {
  // Matches assignHands: a channel in both lists plays in the right hand.
  if (hands.value.right.includes(channel)) return 'right'
  if (hands.value.left.includes(channel)) return 'left'
  return 'hidden'
}

/**
 * Shows a hands change only once it is stored, so the panel never shows (and a quick reload
 * never loses) an unsaved assignment. On failure the store shows the error and the selects
 * are re-rendered from the unchanged, stored assignment.
 */
async function saveHands(next: HandAssignment): Promise<void> {
  const plain = { right: [...next.right], left: [...next.left] }
  if (await store.setHands(props.songId, plain)) {
    hands.value = plain
    handsAreDefault.value = false
  } else {
    handsRevision.value++
  }
}

function setHand(channel: number, hand: Hand | 'hidden'): void {
  const without = (list: readonly number[]) => list.filter((c) => c !== channel)
  const add = (list: readonly number[]) => [...without(list), channel].sort((a, b) => a - b)
  void saveHands({
    right: hand === 'right' ? add(hands.value.right) : without(hands.value.right),
    left: hand === 'left' ? add(hands.value.left) : without(hands.value.left),
  })
}

function swapHands(): void {
  void saveHands({ right: hands.value.left, left: hands.value.right })
}

async function restoreDefaultHands(): Promise<void> {
  if (opened.value === null) return
  if (await store.resetHands(props.songId)) {
    hands.value = defaultHands(opened.value.song.channels)
    handsAreDefault.value = true
  }
}

function saveOverride(override: MeterOverride): void {
  void store.setOverride(props.songId, override)
}

async function deleteUpload(): Promise<void> {
  if (await store.deleteUpload(props.songId, deletePracticeData.value)) emit('close')
}

function play(): void {
  emit('play')
}
</script>

<template>
  <aside class="details" aria-label="Song details" data-testid="song-details">
    <header class="head">
      <h2 class="visually-hidden">{{ entry?.title ?? 'Song' }}</h2>
      <p v-if="entry" class="source" :title="entry.fileName" data-testid="details-source">
        {{ entry.source === 'bundled' ? 'Bundled song' : 'Uploaded' }} · {{ entry.fileName }}
      </p>
    </header>

    <div class="scroll">
      <p v-if="loadError" class="error">{{ loadError }}</p>
      <p v-if="store.error" class="error" role="alert" data-testid="details-error">
        {{ store.error }}
        <IconButton icon="close" label="Dismiss error" size="sm" @click="store.clearError()" />
      </p>

      <template v-if="entry">
        <label class="field">
          <span class="label">Title</span>
          <input
            v-model="title"
            class="text-input"
            data-testid="meta-title"
            @change="saveField('title')"
            @keydown.enter="blurOnEnter"
          />
        </label>
        <div class="field">
          <span class="label">Composer</span>
          <ComboboxField
            v-model="composer"
            :options="composers"
            label="Composer"
            all-label="All composers"
            data-testid="meta-composer"
            @commit="saveField('composer')"
          />
        </div>
        <div class="field">
          <span class="label">Tags</span>
          <TagEditor
            :model-value="entry.tags"
            :suggestions="store.allTags"
            @update:model-value="saveTags"
          />
        </div>
        <div class="row">
          <AppButton
            variant="text"
            size="sm"
            icon="reset"
            :disabled="!entry.edited"
            data-testid="meta-reset"
            @click="resetMeta"
          >
            Reset to original
          </AppButton>
          <AppButton
            v-if="entry.source === 'uploaded'"
            variant="text"
            size="sm"
            data-testid="meta-guess"
            @click="guessMeta"
          >
            Guess from file
          </AppButton>
          <span v-if="entry.edited" class="muted">Original: {{ entry.original.title }}</span>
        </div>
      </template>

      <template v-if="opened && entry">
        <h3 class="section-caps">Hands</h3>
        <div
          v-for="c in opened.song.channels"
          :key="`${c.channel}-${handsRevision}`"
          class="hand-row"
        >
          <span
            class="hand-channel"
            :title="`${c.noteCount} notes, ${noteName(c.minPitch)}–${noteName(c.maxPitch)}`"
          >
            Channel {{ c.channel }} · {{ c.noteCount }} notes
          </span>
          <SelectField
            class="compact"
            :model-value="handOf(c.channel)"
            :options="HAND_OPTIONS"
            :label="`Channel ${c.channel} hand`"
            :data-testid="`hand-ch${c.channel}`"
            @update:model-value="setHand(c.channel, $event)"
          />
        </div>
        <div class="row">
          <AppButton size="sm" @click="swapHands">Swap hands</AppButton>
          <AppButton size="sm" :disabled="handsAreDefault" @click="restoreDefaultHands">
            Restore default
          </AppButton>
        </div>

        <h3 class="section-caps">Meter</h3>
        <p v-if="meter" class="meter" data-testid="meter-line">
          <MeterReadout :summary="meter">{{ meterSource }}</MeterReadout>
        </p>
        <AppButton
          v-if="!entry.override && !editingMeter"
          variant="text"
          size="sm"
          data-testid="edit-meter"
          @click="editingMeter = true"
        >
          Override meter…
        </AppButton>
        <MeterOverrideEditor
          v-else
          :song="opened.song"
          :override="entry.override"
          @save="saveOverride"
          @clear="store.clearOverride(songId)"
        />

        <h3 class="section-caps">File</h3>
        <dl class="facts">
          <dt>Length</dt>
          <dd>{{ formatTime(opened.song.durationSeconds) }}</dd>
          <dt>Bars</dt>
          <dd>
            {{ fileBars }} in the file
            <template v-if="entry.override">· {{ entry.bars }} with the override</template>
          </dd>
          <dt>Tempo</dt>
          <dd>{{ formatTempoRange(entry.facts) }}</dd>
          <dt>Format</dt>
          <dd>
            MIDI {{ opened.song.format }} · {{ opened.song.trackCount }} tracks · ppq
            {{ opened.song.ppq }}
          </dd>
        </dl>

        <template v-if="entry.source === 'uploaded'">
          <AppButton
            v-if="!confirmingDelete"
            size="sm"
            danger
            data-testid="delete-upload"
            @click="confirmingDelete = true"
          >
            Delete upload…
          </AppButton>
          <div v-else class="confirm-block">
            <span>Delete “{{ entry.title }}” and its edits?</span>
            <label class="check">
              <input
                v-model="deletePracticeData"
                type="checkbox"
                data-testid="delete-practice-data"
              />
              Also delete its bookmarks and practice stats
            </label>
            <div class="row confirm">
              <AppButton size="sm" danger data-testid="confirm-delete" @click="deleteUpload">
                Delete
              </AppButton>
              <AppButton size="sm" @click="confirmingDelete = false">Cancel</AppButton>
            </div>
          </div>
        </template>
      </template>
    </div>

    <footer class="foot">
      <AppButton variant="primary" class="play" data-testid="details-play" @click="play">
        Play
      </AppButton>
      <AppButton data-testid="details-bookmarks" @click="emit('bookmarks')">Bookmarks</AppButton>
    </footer>
  </aside>
</template>

<style scoped>
.details {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 340px;
  min-height: 0;
  border-left: 1px solid var(--divider);
}

.head {
  padding: 18px 18px 0;
}

.source {
  margin: 0;
  overflow: hidden;
  color: var(--text-3);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scroll {
  flex: 1;
  min-height: 0;
  padding: 12px 18px 18px;
  overflow-y: auto;
}

.field {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.label {
  color: var(--text-3);
  font-size: var(--text-sm);
}

.text-input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border-field);
  border-radius: 10px;
  background: rgb(255 255 255 / 5%);
  color: var(--text-strong);
  font-size: var(--text-base);
}

.text-input:focus,
.text-input:focus-visible {
  border-color: var(--primary);
  box-shadow: none;
}

.section-caps {
  margin: 18px 0 8px;
  color: var(--text-4);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.hand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-1) 0;
}

.hand-channel {
  color: var(--text-soft);
  font-size: var(--text-md);
}

.meter {
  margin: 0 0 var(--space-1);
  color: var(--text-soft);
  font-size: var(--text-md);
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-4);
  margin: 0 0 var(--space-5);
  font-size: var(--text-sm);
}

dt {
  color: var(--text-3);
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.muted {
  color: var(--text-3);
  font-size: var(--text-sm);
}

.error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: 10px;
  background: var(--field);
  color: var(--danger);
  font-size: var(--text-sm);
}

.confirm {
  font-size: var(--text-sm);
}

.confirm-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.check {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--text-2);
}

.check input {
  accent-color: var(--primary);
}

.foot {
  display: flex;
  gap: var(--space-2);
  padding: 14px 18px 18px;
  border-top: 1px solid var(--divider);
}

.play {
  flex: 1;
}
</style>
