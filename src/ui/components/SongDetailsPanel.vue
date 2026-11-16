<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import type { Hand } from '@/core/hands/Hand'
import { defaultHands } from '@/core/hands/defaultHands'
import type { HandAssignment } from '@/core/hands/HandAssignment'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { SongMetaFields } from '@/core/library/SongMetaFields'
import { noteName } from '@/core/noteName'
import { BarMap } from '@/core/timing/BarMap'
import type { MeterOverride } from '@/core/timing/MeterOverride'
import type { OpenedSong } from '@/data/OpenedSong'

import { formatTime } from '../format/formatTime'
import { useLibraryStore } from '../stores/libraryStore'
import MeterOverrideEditor from './MeterOverrideEditor.vue'
import TagEditor from './TagEditor.vue'

const props = defineProps<{ readonly songId: string }>()
const emit = defineEmits<{ close: []; play: [] }>()

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

/**
 * Saves one text field (on blur, or Enter, which blurs) and waits for the write. Afterwards the
 * field shows what is stored: the saved value (trimmed; an emptied title falls back to the
 * original), or, if the save failed, the previous value while the error is shown. Other fields
 * are sent as stored, so a save never carries along another field's unsaved text.
 */
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

const tempos = computed(() =>
  (opened.value?.song.tempoEvents ?? []).map(
    (e) => `${(60e6 / e.microsPerQuarter).toFixed(1)} BPM @ ${e.tick}`,
  ),
)
const meters = computed(() =>
  (opened.value?.song.timeSignatureEvents ?? []).map(
    (e) => `${e.numerator}/${e.denominator} @ ${e.tick}`,
  ),
)
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
  if (await store.deleteUpload(props.songId)) emit('close')
}

function play(): void {
  emit('play')
}
</script>

<template>
  <aside class="details" aria-label="Song details">
    <header>
      <h2>{{ entry?.title ?? 'Song' }}</h2>
      <button type="button" aria-label="Close details" @click="emit('close')">✕</button>
    </header>

    <div class="actions">
      <button type="button" class="primary" data-testid="details-play" @click="play">Play</button>
    </div>

    <p v-if="loadError" class="error">{{ loadError }}</p>
    <p v-if="store.error" class="error" role="alert" data-testid="details-error">
      {{ store.error }}
      <button type="button" aria-label="Dismiss error" @click="store.clearError()">✕</button>
    </p>

    <fieldset v-if="entry">
      <legend>Metadata</legend>
      <label>
        Title
        <input
          v-model="title"
          data-testid="meta-title"
          @change="saveField('title')"
          @keydown.enter="blurOnEnter"
        />
      </label>
      <label>
        Composer
        <input
          v-model="composer"
          data-testid="meta-composer"
          @change="saveField('composer')"
          @keydown.enter="blurOnEnter"
        />
      </label>
      <div class="field">
        Tags
        <TagEditor
          :model-value="entry.tags"
          :suggestions="store.allTags"
          @update:model-value="saveTags"
        />
      </div>
      <button type="button" :disabled="!entry.edited" data-testid="meta-reset" @click="resetMeta">
        Reset to original
      </button>
      <span v-if="entry.edited" class="muted"> Original: {{ entry.original.title }}</span>
    </fieldset>

    <template v-if="opened && entry">
      <fieldset>
        <legend>Hands</legend>
        <table class="hands">
          <tbody>
            <tr v-for="c in opened.song.channels" :key="`${c.channel}-${handsRevision}`">
              <th scope="row">Channel {{ c.channel }}</th>
              <td>
                <select
                  :value="handOf(c.channel)"
                  :aria-label="`Channel ${c.channel} hand`"
                  :data-testid="`hand-ch${c.channel}`"
                  @change="
                    setHand(
                      c.channel,
                      ($event.target as HTMLSelectElement).value as Hand | 'hidden',
                    )
                  "
                >
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                  <option value="hidden">Hidden</option>
                </select>
              </td>
              <td class="muted">
                {{ c.noteCount }} notes, {{ noteName(c.minPitch) }}–{{ noteName(c.maxPitch) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div class="row">
          <button type="button" @click="swapHands">Swap hands</button>
          <button type="button" :disabled="handsAreDefault" @click="restoreDefaultHands">
            Restore default
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Meter</legend>
        <MeterOverrideEditor
          :song="opened.song"
          :override="entry.override"
          @save="saveOverride"
          @clear="store.clearOverride(songId)"
        />
      </fieldset>

      <fieldset>
        <legend>File</legend>
        <dl>
          <dt>File name</dt>
          <dd>{{ entry.fileName }}</dd>
          <dt>Source</dt>
          <dd>{{ entry.source === 'bundled' ? 'Bundled' : 'Uploaded' }}</dd>
          <dt>Format / ppq / tracks</dt>
          <dd>{{ opened.song.format }} / {{ opened.song.ppq }} / {{ opened.song.trackCount }}</dd>
          <dt>Duration</dt>
          <dd>
            {{ formatTime(opened.song.durationSeconds) }} ({{ opened.song.durationTicks }} ticks)
          </dd>
          <dt>Bars</dt>
          <dd>
            {{ fileBars }} in the file
            <template v-if="entry.override">· {{ entry.bars }} with the meter override</template>
          </dd>
          <dt>Tempo</dt>
          <dd>{{ tempos.join(', ') || 'none (120 BPM)' }}</dd>
          <dt>Time signatures</dt>
          <dd>{{ meters.join(', ') || 'none (4/4)' }}</dd>
        </dl>
      </fieldset>

      <fieldset v-if="entry.source === 'uploaded'">
        <legend>Delete</legend>
        <button
          v-if="!confirmingDelete"
          type="button"
          data-testid="delete-upload"
          @click="confirmingDelete = true"
        >
          Delete upload…
        </button>
        <div v-else class="row">
          <span>Delete “{{ entry.title }}” and its edits?</span>
          <button type="button" class="danger" data-testid="confirm-delete" @click="deleteUpload">
            Delete
          </button>
          <button type="button" @click="confirmingDelete = false">Cancel</button>
        </div>
      </fieldset>
    </template>
  </aside>
</template>

<style scoped>
.details {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 26rem;
  overflow-y: auto;
  padding: 0.75rem 1rem 1.5rem;
  background: rgb(10 14 28 / 97%);
  border-left: 1px solid rgb(120 140 190 / 25%);
  font-size: 0.85rem;
  z-index: 20;
  box-sizing: border-box;
}

/* Narrow screens: a full-screen sheet. */
@media (width < 900px) {
  .details {
    left: 0;
    width: auto;
    border-left: 0;
  }
}

header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 0.5rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

.actions {
  margin: 0.6rem 0;
}

fieldset {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgb(120 140 190 / 20%);
  border-radius: 6px;
}

legend {
  color: #9fb0d8;
}

label,
.field {
  display: grid;
  gap: 0.15rem;
  margin: 0.35rem 0 0.5rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  margin-top: 0.35rem;
}

.hands th {
  text-align: left;
  font-weight: normal;
  padding-right: 0.5rem;
}

.hands td {
  padding: 0.15rem 0.5rem 0.15rem 0;
}

dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.75rem;
  margin: 0;
}

dt {
  color: #8c9abf;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.muted {
  color: #8c9abf;
}

.error {
  color: #ff6b6b;
}

.primary {
  font-weight: 600;
  padding: 0.3rem 1.2rem;
}

.danger {
  color: #ff8a8a;
}
</style>
