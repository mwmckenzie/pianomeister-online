<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { formatAddedAt } from '@/core/library/formatAddedAt'
import type { LibrarySortField } from '@/core/library/LibrarySortField'
import type { ImportReport } from '@/data/ImportReport'
import type { UploadResult } from '@/data/UploadResult'

import AppButton from '../components/AppButton.vue'
import AppIcon from '../components/AppIcon.vue'
import SearchField from '../components/SearchField.vue'
import SelectField from '../components/SelectField.vue'
import SongDetailsPanel from '../components/SongDetailsPanel.vue'
import SongRow from '../components/SongRow.vue'
import SortableHeader from '../components/SortableHeader.vue'
import { formatStorage } from '../format/formatStorage'
import { formatTime } from '../format/formatTime'
import { summariseImport, summariseUploads } from '../format/summariseUploads'
import { useLibraryBackup } from '../library/useLibraryBackup'
import { sceneSnapshot } from '../playback/sceneSnapshot'
import { useLibraryStore } from '../stores/libraryStore'

/**
 * The library page (docs/design/m6/source/QGLibrary.dc.html): filters on the left, the song
 * table in the middle (its headers are the sort controls), and the details of the selected song
 * on the right, always shown (the first song until another is chosen).
 */
const router = useRouter()
const store = useLibraryStore()
const { search, sortField, sortDirection, groupBy, tagFilter, sourceFilter } = storeToRefs(store)
const backup = useLibraryBackup()
const uploadInput = useTemplateRef<HTMLInputElement>('uploadInput')
const importInput = useTemplateRef<HTMLInputElement>('importInput')
const songList = useTemplateRef<HTMLElement>('songList')

const selectedId = ref<string | null>(null)
const uploadResults = ref<readonly UploadResult[]>([])
const importReport = ref<ImportReport | null>(null)
const dragDepth = ref(0)
/** For the "Added" column; a page left open past midnight is fine with yesterday's "Today". */
const now = Date.now()

const busy = backup.busy
const error = backup.error

const GROUP_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'composer', label: 'Composer' },
  { value: 'tag', label: 'Tag' },
] as const
const COLUMNS: readonly {
  readonly field: LibrarySortField
  readonly label: string
  readonly num?: boolean
}[] = [
  { field: 'title', label: 'Title' },
  { field: 'composer', label: 'Composer' },
  { field: 'duration', label: 'Length', num: true },
  { field: 'bars', label: 'Bars', num: true },
  { field: 'dateAdded', label: 'Added', num: true },
]

const sources = computed(() => {
  const count = (source: 'bundled' | 'uploaded') =>
    store.entries.filter((e) => e.source === source).length
  return [
    { value: 'all', label: 'All songs', count: store.entries.length },
    { value: 'bundled', label: 'Bundled', count: count('bundled') },
    { value: 'uploaded', label: 'Uploaded', count: count('uploaded') },
  ] as const
})

const storageLine = computed(() => formatStorage(store.storage))
const uploadSummary = computed(() =>
  uploadResults.value.length === 0 ? '' : summariseUploads(uploadResults.value),
)
const importSummary = computed(() =>
  importReport.value === null ? '' : summariseImport(importReport.value),
)
/** The rows in display order (groups flattened), for ↑/↓. */
const rows = computed(() => store.groups.flatMap((g) => g.entries))
const backdrop = computed(() =>
  sceneSnapshot.value === null ? undefined : { backgroundImage: `url(${sceneSnapshot.value})` },
)

// The details panel always shows a song: keep the selection on a visible row.
watch(
  rows,
  (list) => {
    if (!list.some((e) => e.songId === selectedId.value)) selectedId.value = list[0]?.songId ?? null
  },
  { immediate: true },
)

function uploadFiles(files: readonly File[]): Promise<unknown> {
  return backup.run(async () => {
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

async function onImportChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) return
  uploadResults.value = []
  importReport.value = await backup.importFile(file)
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

function ariaSort(field: LibrarySortField): 'ascending' | 'descending' | 'none' {
  if (sortField.value !== field) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function move(step: number): void {
  const list = rows.value
  const index = list.findIndex((e) => e.songId === selectedId.value)
  const next = list[Math.min(list.length - 1, Math.max(0, index + step))]
  if (next === undefined) return
  selectedId.value = next.songId
  void nextTick(() =>
    songList.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }),
  )
}

function onListKeyDown(event: KeyboardEvent): void {
  const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
  const by = step[event.key]
  if (by === undefined) return
  event.preventDefault()
  move(by)
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

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  void backup.run(async () => {
    await store.refresh()
    await store.refreshStorage()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})
</script>

<template>
  <main class="library-page">
    <div
      class="backdrop"
      :class="{ snapshot: backdrop !== undefined }"
      :style="backdrop"
      data-testid="library-backdrop"
    />
    <div class="window glass">
      <header class="top">
        <RouterLink :to="{ name: 'player' }" class="back" data-testid="back-to-player">
          <AppIcon name="chevronLeft" :size="18" /> Player
        </RouterLink>
        <!-- The Bookmarks tab joins in milestone 7. -->
        <nav class="tabs" role="tablist" aria-label="Library sections">
          <span role="tab" aria-selected="true" class="tab active">Library</span>
        </nav>
        <SearchField v-model="search" label="Search library" data-testid="search" />
        <AppButton
          variant="primary"
          :disabled="busy"
          data-testid="upload"
          @click="uploadInput?.click()"
        >
          Upload MIDI
        </AppButton>
        <AppButton :disabled="busy" data-testid="export" @click="backup.exportLibrary()">
          Export
        </AppButton>
        <AppButton :disabled="busy" data-testid="import" @click="importInput?.click()">
          Import
        </AppButton>
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
      </header>

      <div class="body">
        <aside class="filters" aria-label="Filters">
          <div class="group sources" role="group" aria-labelledby="source-heading">
            <h2 id="source-heading" class="section-caps">Source</h2>
            <button
              v-for="s in sources"
              :key="s.value"
              type="button"
              class="source"
              :aria-pressed="sourceFilter === s.value"
              :data-testid="`source-${s.value}`"
              @click="sourceFilter = s.value"
            >
              {{ s.label }} <span class="count">{{ s.count }}</span>
            </button>
          </div>

          <div v-if="store.allTags.length > 0" class="group">
            <h2 class="section-caps">Tags</h2>
            <div class="chips" role="group" aria-label="Filter by tag">
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
            </div>
          </div>

          <div class="group">
            <h2 class="section-caps">Group by</h2>
            <SelectField
              v-model="groupBy"
              :options="GROUP_OPTIONS"
              label="Group by"
              data-testid="group"
            />
          </div>

          <p class="storage">
            <span data-testid="storage-status">{{ storageLine }}</span>
            <span v-if="busy"> · working…</span>
          </p>
        </aside>

        <section class="list" aria-label="Songs">
          <div v-if="uploadSummary || importSummary || error || store.error" class="notices">
            <p v-if="uploadSummary" class="notice" data-testid="upload-summary">
              {{ uploadSummary }}
            </p>
            <p v-if="importSummary" class="notice" data-testid="import-summary">
              {{ importSummary }}
            </p>
            <p v-if="error" class="error" role="alert" data-testid="library-error">{{ error }}</p>
            <p v-if="store.error" class="error" role="alert" data-testid="library-write-error">
              {{ store.error }}
              <button
                type="button"
                class="dismiss"
                aria-label="Dismiss error"
                @click="store.clearError()"
              >
                <AppIcon name="close" :size="14" />
              </button>
            </p>
          </div>
          <div class="table-head" role="row">
            <span
              v-for="c in COLUMNS"
              :key="c.field"
              role="columnheader"
              :class="{ num: c.num }"
              :aria-sort="ariaSort(c.field)"
            >
              <SortableHeader
                :label="c.label"
                :active="sortField === c.field"
                :direction="sortDirection"
                :align="c.num ? 'end' : 'start'"
                :data-testid="`sort-${c.field}`"
                @sort="sortBy(c.field)"
              />
            </span>
          </div>
          <div
            ref="songList"
            class="rows"
            role="listbox"
            tabindex="0"
            aria-label="Songs"
            :aria-activedescendant="selectedId ? `song-${selectedId}` : undefined"
            @keydown="onListKeyDown"
          >
            <div
              v-for="group in store.groups"
              :key="group.label"
              role="group"
              :aria-label="group.label || 'All songs'"
            >
              <div v-if="group.label !== ''" class="group-label">
                {{ group.label }} <span class="count">{{ group.entries.length }}</span>
              </div>
              <SongRow
                v-for="e in group.entries"
                :id="`song-${e.songId}`"
                :key="`${group.label}/${e.songId}`"
                role="option"
                :title="e.title"
                :selected="e.songId === selectedId"
                :aria-selected="e.songId === selectedId"
                data-testid="song-row"
                @click="selectedId = e.songId"
                @dblclick="play(e.songId)"
              >
                <span class="cell-text composer" :title="e.composer">{{ e.composer }}</span>
                <span class="num">{{ formatTime(e.facts.durationSeconds) }}</span>
                <span class="num">{{ e.bars }}</span>
                <span class="num muted">{{ formatAddedAt(e.addedAt, now) }}</span>
              </SongRow>
            </div>
          </div>
          <p v-if="store.loaded && store.visible.length === 0" class="empty">No songs match.</p>
          <button type="button" class="drop-zone" @click="uploadInput?.click()">
            Drop .mid files anywhere to add them
          </button>
        </section>

        <SongDetailsPanel
          v-if="selectedId !== null"
          :song-id="selectedId"
          @close="selectedId = rows[0]?.songId ?? null"
          @play="selectedId !== null && play(selectedId)"
        />
        <aside v-else class="no-details" aria-label="Song details">
          {{ store.loaded ? 'No song selected.' : '' }}
        </aside>
      </div>
    </div>

    <div v-if="dragDepth > 0" class="drop" data-testid="drop-overlay">
      Drop MIDI files to add them to the library
    </div>
  </main>
</template>

<style scoped>
.library-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--bg);
}

/* The player's last frame, blurred, behind the glass (static gradient when there is none). */
.backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 50% 110%, rgb(40 70 140 / 25%), transparent 60%),
    linear-gradient(180deg, #05070f, #0a0f1e);
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
  background: rgb(5 7 15 / 72%);
  content: '';
}

.window {
  position: absolute;
  inset: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-lg);
  --glass-alpha: 0.55;
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: 14px 18px;
  border-bottom: 1px solid var(--divider);
}

.top :deep(.search-field) {
  min-width: 200px;
}

.top :deep(.btn.md) {
  min-height: 40px;
  padding: 0 14px;
}

.top :deep(.btn.primary) {
  padding: 0 16px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px 0 10px;
  border-radius: var(--radius-md);
  background: var(--field);
  color: var(--text-1);
  font-size: var(--text-md);
  text-decoration: none;
}

.tabs {
  display: flex;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--field);
}

.tab {
  padding: 8px 16px;
  border-radius: 9px;
  color: var(--text-2);
  font-size: var(--text-md);
}

.tab.active {
  background: rgb(var(--primary-rgb) / 22%);
  color: var(--text-strong);
  font-weight: var(--weight-medium);
}

.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.filters {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 18px;
  width: 190px;
  padding: 16px 14px;
  overflow-y: auto;
  border-right: 1px solid var(--divider);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sources {
  gap: 4px;
}

.group .section-caps {
  padding-bottom: 2px;
  color: var(--text-4);
}

.sources .section-caps {
  padding-bottom: 4px;
}

.source {
  padding: 7px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-2);
  font-size: var(--text-md);
  text-align: left;
  cursor: pointer;
}

.source:hover {
  background: var(--field);
}

.source[aria-pressed='true'] {
  background: rgb(var(--primary-rgb) / 16%);
  color: var(--text-strong);
}

.count {
  color: var(--text-4);
}

.source[aria-pressed='true'] .count {
  color: var(--text-3);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  padding: 5px 10px;
  border: 1px solid var(--border-field);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-soft);
  font-size: var(--text-sm);
  cursor: pointer;
}

.chip[aria-pressed='true'] {
  border-color: var(--primary);
  background: rgb(var(--primary-rgb) / 18%);
  color: var(--text-strong);
}

.storage {
  margin: auto 0 0;
  color: var(--text-3);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.list {
  --song-columns: minmax(0, 2.2fr) minmax(0, 1.6fr) 64px 56px 80px;
  --song-row-padding: 12px 18px;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow-y: auto;
}

.notices {
  padding: var(--space-3) 18px 0;
}

.notice,
.error {
  margin: 0 0 var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: 10px;
  background: var(--field);
  font-size: var(--text-sm);
}

.error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--danger);
}

.dismiss {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.table-head {
  position: sticky;
  z-index: 1;
  top: 0;
  display: grid;
  grid-template-columns: var(--song-columns);
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--divider-soft);
  background: rgb(var(--glass-rgb) / 92%);
}

.table-head .num {
  display: grid;
  justify-items: end;
}

.rows:focus-visible {
  box-shadow: inset var(--focus-ring-field);
}

.composer {
  color: var(--text-soft);
}

.group-label {
  padding: 14px 18px 6px;
  color: var(--text-3);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
}

.empty {
  padding: var(--space-4) 18px;
  color: var(--text-3);
  font-size: var(--text-md);
}

.drop-zone {
  flex-shrink: 0;
  margin: 16px 18px;
  padding: 18px;
  border: 1.5px dashed rgb(255 255 255 / 18%);
  border-radius: 14px;
  background: transparent;
  color: var(--text-3);
  font-size: var(--text-md);
  cursor: pointer;
}

.drop-zone:hover {
  color: var(--text-1);
}

.no-details {
  flex-shrink: 0;
  width: 340px;
  padding: 18px;
  border-left: 1px solid var(--divider);
  color: var(--text-3);
  font-size: var(--text-md);
}

.drop {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: grid;
  place-items: center;
  border: 3px dashed var(--primary);
  background: rgb(5 7 15 / 85%);
  color: var(--text-1);
  font-size: var(--text-xl);
  pointer-events: none;
}

/* 1024 px: the filter and details columns keep their widths; the table narrows. */
@media (width < 1100px) {
  .list {
    --song-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) 52px 40px 72px;
    --song-row-padding: 12px 14px;
  }

  .table-head {
    padding: 12px 14px;
  }
}
</style>
