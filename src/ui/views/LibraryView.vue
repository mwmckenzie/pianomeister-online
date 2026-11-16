<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import type { LibrarySortField } from '@/core/library/LibrarySortField'
import type { ImportReport } from '@/data/ImportReport'
import type { UploadResult } from '@/data/UploadResult'

import SongDetailsPanel from '../components/SongDetailsPanel.vue'
import { formatBytes } from '../format/formatBytes'
import { formatTime } from '../format/formatTime'
import { useLibraryStore } from '../stores/libraryStore'

const router = useRouter()
const store = useLibraryStore()
const { search, sortField, sortDirection, groupBy, tagFilter, sourceFilter } = storeToRefs(store)

const uploadInput = useTemplateRef<HTMLInputElement>('uploadInput')
const importInput = useTemplateRef<HTMLInputElement>('importInput')

const selectedId = ref<string | null>(null)
const busy = ref(false)
const error = ref('')
const uploadResults = ref<readonly UploadResult[]>([])
const importReport = ref<ImportReport | null>(null)
const dragDepth = ref(0)

const SORT_FIELDS: readonly { readonly value: LibrarySortField; readonly label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'composer', label: 'Composer' },
  { value: 'duration', label: 'Duration' },
  { value: 'dateAdded', label: 'Date added' },
  { value: 'source', label: 'Source' },
]

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

const storageLine = computed(() => {
  const s = store.storage
  if (s === null) return ''
  const persisted = s.persisted === null ? 'unknown' : s.persisted ? 'persistent' : 'not persistent'
  const usage = s.usage === null ? '' : ` · ${formatBytes(s.usage)} used`
  return `Storage: ${persisted}${usage}`
})

/** "2 added, 1 duplicate, 1 rejected — not a MIDI file" */
function summarise(results: readonly UploadResult[]): string {
  const count = (outcome: UploadResult['outcome']) =>
    results.filter((r) => r.outcome === outcome).length
  const parts = [`${count('added')} added`]
  if (count('duplicate') > 0) parts.push(`${count('duplicate')} duplicate`)
  const rejected = results.filter((r) => r.outcome === 'rejected')
  if (rejected.length > 0) {
    const reasons = [...new Set(rejected.map((r) => r.reason))].join('; ')
    parts.push(`${rejected.length} rejected — ${reasons}`)
  }
  return parts.join(', ')
}

const uploadSummary = computed(() =>
  uploadResults.value.length === 0 ? '' : summarise(uploadResults.value),
)

const importSummary = computed(() => {
  const r = importReport.value
  if (r === null) return ''
  const parts = [`Imported: ${summarise(r.uploads)}`]
  const applied = r.metaApplied + r.overridesApplied
  if (applied > 0) parts.push(`${applied} song settings applied`)
  const kept = r.metaKept + r.overridesKept
  if (kept > 0) parts.push(`local edits kept for ${kept} (not overwritten)`)
  if (r.unknownSongs > 0) parts.push(`${r.unknownSongs} skipped (song not in library)`)
  return parts.join('. ')
})

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    console.error('[library]', e)
  } finally {
    busy.value = false
  }
}

function uploadFiles(files: readonly File[]): Promise<void> {
  return run(async () => {
    importReport.value = null
    uploadResults.value = await store.upload(files)
  })
}

function onUploadChosen(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (files.length > 0) void uploadFiles(files)
}

function onImportChosen(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) return
  void run(async () => {
    uploadResults.value = []
    importReport.value = await store.importArchive(new Uint8Array(await file.arrayBuffer()))
  })
}

function exportLibrary(): void {
  void run(async () => {
    const bytes = await store.exportArchive()
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/zip' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `pianomeister-library-${new Date().toISOString().slice(0, 10)}.zip`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  })
}

function sortBy(field: LibrarySortField): void {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    // Newest first is the useful default for dates.
    sortDirection.value = field === 'dateAdded' ? 'desc' : 'asc'
  }
}

async function play(songId: string): Promise<void> {
  // The player opens the last song, so stay here (error shown) if it couldn't be saved.
  if (await store.setLastSongId(songId)) await router.push({ name: 'player' })
}

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

function onDragEnter(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  dragDepth.value++
}

function onDragOver(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(event: DragEvent): void {
  if (!hasFiles(event)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function onDrop(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  dragDepth.value = 0
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length > 0) void uploadFiles(files)
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') selectedId.value = null
}

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  window.addEventListener('keydown', onKeyDown)
  void run(async () => {
    await store.refresh()
    await store.refreshStorage()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <main class="library" :class="{ 'with-details': selectedId !== null }">
    <header class="top">
      <RouterLink :to="{ name: 'player' }" class="back">← Player</RouterLink>
      <h1>Library</h1>
      <div class="buttons">
        <button type="button" :disabled="busy" data-testid="upload" @click="uploadInput?.click()">
          Upload…
        </button>
        <button type="button" :disabled="busy" data-testid="export" @click="exportLibrary">
          Export
        </button>
        <button type="button" :disabled="busy" data-testid="import" @click="importInput?.click()">
          Import…
        </button>
        <input
          ref="uploadInput"
          type="file"
          accept=".mid,.midi,audio/midi,audio/x-midi"
          multiple
          hidden
          data-testid="upload-input"
          @change="onUploadChosen"
        />
        <input
          ref="importInput"
          type="file"
          accept=".zip,application/zip"
          hidden
          data-testid="import-input"
          @change="onImportChosen"
        />
      </div>
    </header>

    <section class="controls" aria-label="Find songs">
      <input
        v-model="search"
        type="search"
        placeholder="Search title, composer, tags"
        aria-label="Search"
        data-testid="search"
      />
      <label>
        Sort
        <select v-model="sortField" data-testid="sort">
          <option v-for="f in SORT_FIELDS" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </label>
      <button
        type="button"
        :aria-label="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
        @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
      >
        {{ sortDirection === 'asc' ? '↑' : '↓' }}
      </button>
      <label>
        Group
        <select v-model="groupBy" data-testid="group">
          <option value="none">None</option>
          <option value="composer">Composer</option>
          <option value="tag">Tag</option>
        </select>
      </label>
      <div class="segmented" role="group" aria-label="Source">
        <button
          v-for="s in ['all', 'bundled', 'uploaded'] as const"
          :key="s"
          type="button"
          :aria-pressed="sourceFilter === s"
          @click="sourceFilter = s"
        >
          {{ s === 'all' ? 'All' : s === 'bundled' ? 'Bundled' : 'Uploaded' }}
        </button>
      </div>
    </section>

    <section v-if="store.allTags.length > 0" class="chips" aria-label="Filter by tag">
      <button
        v-for="tag in store.allTags"
        :key="tag"
        type="button"
        class="chip"
        :aria-pressed="tagFilter.some((t) => t.toLowerCase() === tag.toLowerCase())"
        :data-testid="`tag-filter-${tag}`"
        @click="store.toggleTag(tag)"
      >
        {{ tag }}
      </button>
    </section>

    <p class="status muted">
      <span data-testid="storage-status">{{ storageLine }}</span>
      <span v-if="busy"> · working…</span>
    </p>
    <p v-if="uploadSummary" class="notice" data-testid="upload-summary">{{ uploadSummary }}</p>
    <p v-if="importSummary" class="notice" data-testid="import-summary">{{ importSummary }}</p>
    <p v-if="error" class="error" role="alert" data-testid="library-error">{{ error }}</p>
    <p v-if="store.error" class="error" role="alert" data-testid="library-write-error">
      {{ store.error }}
      <button type="button" aria-label="Dismiss error" @click="store.clearError()">✕</button>
    </p>

    <table class="songs">
      <thead>
        <tr>
          <th scope="col">
            <button type="button" class="sort" @click="sortBy('title')">Title</button>
          </th>
          <th scope="col">
            <button type="button" class="sort" @click="sortBy('composer')">Composer</button>
          </th>
          <th scope="col">Tags</th>
          <th scope="col" class="num">
            <button type="button" class="sort" @click="sortBy('duration')">Length</button>
          </th>
          <th scope="col" class="num">Bars</th>
          <th scope="col">Meter</th>
          <th scope="col" class="num">BPM</th>
          <th scope="col">
            <button type="button" class="sort" @click="sortBy('source')">Source</button>
          </th>
          <th scope="col">
            <button type="button" class="sort" @click="sortBy('dateAdded')">Added</button>
          </th>
        </tr>
      </thead>
      <tbody v-for="group in store.groups" :key="group.label">
        <tr v-if="group.label !== ''" class="group">
          <th colspan="9" scope="rowgroup">{{ group.label }} ({{ group.entries.length }})</th>
        </tr>
        <tr
          v-for="e in group.entries"
          :key="`${group.label}/${e.songId}`"
          :class="{ selected: e.songId === selectedId }"
          data-testid="song-row"
          tabindex="0"
          @click="selectedId = e.songId"
          @keydown.enter="selectedId = e.songId"
        >
          <td class="title">{{ e.title }}</td>
          <td>{{ e.composer }}</td>
          <td>
            <span v-for="t in e.tags" :key="t" class="tag">{{ t }}</span>
          </td>
          <td class="num">{{ formatTime(e.facts.durationSeconds) }}</td>
          <td class="num">{{ e.bars }}</td>
          <td>{{ e.timeSignature }}</td>
          <td class="num">{{ Math.round(e.facts.bpm) }}</td>
          <td>{{ e.source === 'bundled' ? 'Bundled' : 'Uploaded' }}</td>
          <td>{{ e.addedAt === null ? '' : dateFormat.format(e.addedAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="store.loaded && store.visible.length === 0" class="muted">No songs match.</p>

    <SongDetailsPanel
      v-if="selectedId !== null"
      :song-id="selectedId"
      @close="selectedId = null"
      @play="play(selectedId)"
    />

    <div v-if="dragDepth > 0" class="drop" data-testid="drop-overlay">
      Drop MIDI files to add them to the library
    </div>
  </main>
</template>

<style scoped>
.library {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 0.75rem 1rem 2rem;
  background: #05070f;
  color: #e6ecff;
  font-size: 0.9rem;
}

@media (width >= 900px) {
  .library.with-details {
    padding-right: 27rem;
  }
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}

h1 {
  margin: 0;
  font-size: 1.3rem;
}

.back {
  color: #9fb0d8;
}

.buttons {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  margin: 0.75rem 0 0.5rem;
}

.controls input[type='search'] {
  flex: 1 1 14rem;
  max-width: 24rem;
}

.segmented {
  display: inline-flex;
}

.segmented button[aria-pressed='true'],
.chip[aria-pressed='true'] {
  background: #3a4a6e;
  color: #fff;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
}

.status {
  margin: 0.5rem 0 0.25rem;
}

.notice {
  margin: 0.25rem 0;
  color: #c8d4f0;
}

.muted {
  color: #8c9abf;
}

.error {
  color: #ff6b6b;
}

.songs {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}

.songs th,
.songs td {
  padding: 0.35rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid rgb(120 140 190 / 15%);
  vertical-align: top;
}

.songs .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.songs tbody tr[data-testid='song-row'] {
  cursor: pointer;
}

.songs tbody tr[data-testid='song-row']:hover,
.songs tr.selected {
  background: rgb(58 74 110 / 35%);
}

.group th {
  padding-top: 0.9rem;
  color: #9fb0d8;
  font-weight: 600;
}

.title {
  font-weight: 600;
}

.sort {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.tag {
  display: inline-block;
  margin: 0 0.25rem 0.15rem 0;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: rgb(92 111 153 / 35%);
}

/* Narrow screens: hide the less important columns. */
@media (width < 700px) {
  .songs th:nth-child(n + 5),
  .songs td:nth-child(n + 5) {
    display: none;
  }
}

.drop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(5 7 15 / 85%);
  border: 3px dashed #5c6f99;
  font-size: 1.4rem;
  z-index: 30;
  pointer-events: none;
}
</style>
