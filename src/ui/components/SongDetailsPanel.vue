<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'

import { allComposers } from '@/core/library/composerSuggestions'
import { formatTempoRange } from '@/core/library/formatTempoRange'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { SongMetaFields } from '@/core/library/SongMetaFields'
import { BarMap } from '@/core/timing/BarMap'
import type { MeterOverride } from '@/core/timing/MeterOverride'
import { summariseMeter } from '@/core/timing/summariseMeter'
import type { OpenedSong } from '@/data/OpenedSong'

import { formatTime } from '../format/formatTime'
import { useLibraryStore } from '../stores/libraryStore'
import AddToPlaylistMenu from '../playlists/AddToPlaylistMenu.vue'
import AppButton from './AppButton.vue'
import ComboboxField from './ComboboxField.vue'
import HandsSection from './HandsSection.vue'
import IconButton from './IconButton.vue'
import MeterOverrideEditor from './MeterOverrideEditor.vue'
import MeterReadout from './MeterReadout.vue'
import TagEditor from './TagEditor.vue'

const props = defineProps<{ readonly songId: string }>()
const emit = defineEmits<{ close: []; play: []; bookmarks: [] }>()

const store = useLibraryStore()
const entry = computed(() => store.entries.find((e) => e.songId === props.songId) ?? null)

const opened = shallowRef<OpenedSong | null>(null)
const loadError = ref('')
const title = ref('')
const composer = ref('')
const confirmingDelete = ref(false)
/** Deleting an upload keeps its bookmarks and stats unless ticked (decision 74). */
const deletePracticeData = ref(false)
const editingMeter = ref(false)
const confirmBlock = useTemplateRef<HTMLElement>('confirmBlock')

// The delete confirm can open below the fold of the panel: bring its buttons into view
// (smoothly, unless motion is reduced, decision 54).
watch(confirmingDelete, async (open) => {
  if (!open) return
  await nextTick()
  const reduced = document.documentElement.dataset.motion === 'reduced'
  confirmBlock.value?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
})

/** Loads the song and its stored settings; also used to undo a change whose save failed. */
async function load(songId: string): Promise<void> {
  loadError.value = ''
  try {
    const song = await store.openSong(songId)
    if (songId !== props.songId) return
    opened.value = song
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
        <HandsSection :song-id="songId" :hands="entry.hands" />

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
          <div v-else ref="confirmBlock" class="confirm-block" data-testid="delete-confirm">
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
      <AddToPlaylistMenu :song-id="songId" />
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
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 14px 18px 18px;
  border-top: 1px solid var(--divider);
}

.play {
  flex: 1;
}
</style>
