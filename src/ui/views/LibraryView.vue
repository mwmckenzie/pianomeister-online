<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { filterEntries } from '@/core/library/filterEntries'
import { formatAddedAt } from '@/core/library/formatAddedAt'
import { formatUploadToast } from '@/core/library/formatUploadToast'
import type { LibrarySortField } from '@/core/library/LibrarySortField'
import { matchesSearch } from '@/core/library/matchesSearch'
import { formatLastPracticed } from '@/core/stats/formatLastPracticed'
import { formatPlays } from '@/core/stats/formatPlays'
import type { ImportReport } from '@/data/ImportReport'
import type { UploadResult } from '@/data/UploadResult'

import AppButton from '../components/AppButton.vue'
import AppIcon from '../components/AppIcon.vue'
import HomeLink from '../components/HomeLink.vue'
import SearchField from '../components/SearchField.vue'
import SelectField from '../components/SelectField.vue'
import SongDetailsPanel from '../components/SongDetailsPanel.vue'
import SongRow from '../components/SongRow.vue'
import SortableHeader from '../components/SortableHeader.vue'
import { formatStorage } from '../format/formatStorage'
import { formatTime } from '../format/formatTime'
import { summariseImport, summariseUploads } from '../format/summariseUploads'
import ManageTabs from '../library/ManageTabs.vue'
import { manageTabStep } from '../library/manageTabStep'
import { useLibraryBackup } from '../library/useLibraryBackup'
import { sceneSnapshot } from '../playback/sceneSnapshot'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { usePracticeStore } from '../stores/practiceStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useStatsStore } from '../stores/statsStore'
import { pageListCommand } from '../input/pageListCommand'
import { useToastStore } from '../stores/toastStore'

/**
 * The library page (docs/design/m6/source/QGLibrary.dc.html): filters on the left, the song
 * table in the middle (its headers are the sort controls, practice columns included, brief
 * decision 73), and the details of the selected song on the right, always shown (the first song
 * until another is chosen).
 */
const router = useRouter()
const store = useLibraryStore()
const bookmarks = useBookmarkStore()
const stats = useStatsStore()
const practice = usePracticeStore()
const toasts = useToastStore()
const settings = useSettingsStore()
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
  { field: 'plays', label: 'Plays', num: true },
  { field: 'last', label: 'Last', num: true },
  { field: 'dateAdded', label: 'Added', num: true },
]

/** A song row's subtitle: its bookmark count ("2 bookmarks"), nothing without any. */
function bookmarkCount(songId: string): string {
  const n = bookmarks.forSong(songId).length
  if (n === 0) return ''
  return n === 1 ? '1 bookmark' : `${n} bookmarks`
}

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

/** The song open in the player (milestone 9.2 E): selected when the Library opens. */
const currentSongId = computed(() => practice.songId)
/** A search or filter hides the current song: say so instead of clearing it silently. */
const currentHidden = computed(
  () =>
    store.loaded &&
    currentSongId.value !== null &&
    store.entries.some((e) => e.songId === currentSongId.value) &&
    !rows.value.some((e) => e.songId === currentSongId.value),
)

// The details panel always shows a song: keep the selection on a visible row, the current
// song's when it's there.
watch(
  rows,
  (list) => {
    if (list.some((e) => e.songId === selectedId.value)) return
    const current = list.find((e) => e.songId === currentSongId.value)
    selectedId.value = current?.songId ?? list[0]?.songId ?? null
  },
  { immediate: true },
)

/** Scrolls the selected song to the middle of the list and puts focus there. */
async function revealSelected(): Promise<void> {
  await nextTick()
  songList.value
    ?.querySelector(`#song-${CSS.escape(selectedId.value ?? '')}`)
    ?.scrollIntoView({ block: 'center' })
  songList.value?.focus({ preventScroll: true })
}

/** "Show": clears what hides the current song, then selects and reveals it. */
function showCurrent(): void {
  const id = currentSongId.value
  if (id === null) return
  clearFiltersHiding(id)
  selectedId.value = id
  void revealSelected()
}

/** Songs added while on this page: tagged "New" until the library is left (decision 82). */
const newSongIds = ref<ReadonlySet<string>>(new Set())
/** The row pulsing now; `pulseKey` restarts the pulse when the same row is pointed at again. */
const pulseId = ref<string | null>(null)
const pulseKey = ref(0)
let pulseTimer: ReturnType<typeof setTimeout> | undefined

/**
 * After an upload or drop: select the first new song (else the first one already in the
 * library), clear a search or filter that would hide it, scroll it to the middle of the list,
 * pulse it, and say what happened in a toast.
 */
async function showUploaded(results: readonly UploadResult[]): Promise<void> {
  const added = results.filter((r) => r.outcome === 'added')
  const duplicates = results.filter((r) => r.outcome === 'duplicate')
  const target = added[0] ?? duplicates[0]
  newSongIds.value = new Set([...newSongIds.value, ...added.map((r) => r.songId)])
  let filtersCleared = false
  if (target !== undefined) {
    filtersCleared = clearFiltersHiding(target.songId)
    selectedId.value = target.songId
    await nextTick()
    songList.value
      ?.querySelector(`#song-${CSS.escape(target.songId)}`)
      ?.scrollIntoView({ block: 'center' })
    pulseId.value = target.songId
    pulseKey.value++
    clearTimeout(pulseTimer)
    pulseTimer = setTimeout(() => (pulseId.value = null), 1300)
  }
  const message = formatUploadToast({
    added: added.map((r) => r.title),
    duplicates: duplicates.map((r) => r.title),
    rejected: results.length - added.length - duplicates.length,
    filtersCleared,
  })
  if (message !== '') toasts.show(message)
}

/** Clears whichever of search, source and tag filter hides the song; true if any did. */
function clearFiltersHiding(songId: string): boolean {
  const entry = store.entries.find((e) => e.songId === songId)
  if (entry === undefined) return false
  let cleared = false
  if (!matchesSearch(entry, search.value)) {
    search.value = ''
    cleared = true
  }
  if (filterEntries([entry], { tags: [], source: sourceFilter.value }).length === 0) {
    sourceFilter.value = 'all'
    cleared = true
  }
  if (filterEntries([entry], { tags: tagFilter.value, source: 'all' }).length === 0) {
    tagFilter.value = []
    cleared = true
  }
  return cleared
}

onBeforeUnmount(() => clearTimeout(pulseTimer))

function uploadFiles(files: readonly File[]): Promise<unknown> {
  return backup.run(async () => {
    importReport.value = null
    uploadResults.value = await store.upload(files)
    await showUploaded(uploadResults.value)
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
    // Text sorts A–Z first; dates and practice columns newest or most first.
    sortDirection.value = field === 'title' || field === 'composer' ? 'asc' : 'desc'
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

/**
 * The filter column as one list for Shift+↑/↓ (brief decision 90): All songs (no source or tag
 * filter), the sources, then the tags. Reaching an item applies it: a source on its own, or the
 * tag as the only tag with the source kept. Clicking a tag still toggles several.
 */
const filterItems = computed((): readonly string[] => [
  ...sources.value.map((s) => s.value),
  ...store.allTags.map((t) => `tag:${t}`),
])
/** The filter item last clicked or reached, marked in the column; else the source in use. */
const filterCursor = ref<string | null>(null)
const shownCursor = computed(() =>
  filterCursor.value !== null && filterItems.value.includes(filterCursor.value)
    ? filterCursor.value
    : sourceFilter.value,
)

function chooseSource(value: (typeof sources.value)[number]['value']): void {
  sourceFilter.value = value
  // "All songs" shows everything: no tag filter either.
  if (value === 'all') tagFilter.value = []
  filterCursor.value = value
}

function clickTag(tag: string): void {
  store.toggleTag(tag)
  filterCursor.value = `tag:${tag}`
}

function moveFilter(step: number): void {
  const items = filterItems.value
  const index = items.indexOf(shownCursor.value)
  const next = items[Math.min(items.length - 1, Math.max(0, index + step))]
  if (next === undefined) return
  const hadFocus = document.activeElement?.closest('[data-filter-cursor]') != null
  if (next.startsWith('tag:')) {
    tagFilter.value = [next.slice(4)]
    filterCursor.value = next
  } else {
    chooseSource(next as (typeof sources.value)[number]['value'])
    tagFilter.value = []
  }
  void nextTick(() => {
    const el = document.querySelector<HTMLElement>('[data-filter-cursor="true"]')
    el?.scrollIntoView({ block: 'nearest' })
    if (hadFocus) el?.focus()
  })
}

/** Why the list is empty: the filters (with the key back to All songs), or the search. */
const emptyText = computed(() => {
  if (sourceFilter.value === 'all' && tagFilter.value.length === 0) return 'No songs match.'
  const key = settings.shortcutLabel('secondaryPrevious')
  return key === ''
    ? 'No songs match these filters'
    : `No songs match these filters · ${key} to All songs`
})

/** List keys by role, wherever focus is on the page (brief decisions 90–91). */
function onPageKeyDown(event: KeyboardEvent): void {
  const command = pageListCommand(event, settings.bindings)
  switch (command) {
    case 'listNext':
    case 'listPrevious':
      move(command === 'listNext' ? 1 : -1)
      break
    case 'secondaryNext':
    case 'secondaryPrevious':
      moveFilter(command === 'secondaryNext' ? 1 : -1)
      break
    case 'listOpen':
      if (selectedId.value === null) return
      void play(selectedId.value)
      break
    case 'nextTab':
    case 'previousTab':
      // Library | Bookmarks | Playlists: the tabs wrap.
      void router.push({ name: manageTabStep('library', command === 'nextTab' ? 1 : -1) })
      break
    default:
      return
  }
  event.preventDefault()
}

async function play(songId: string): Promise<void> {
  // The player opens the last song, so stay here (error shown) if it couldn't be saved.
  if (await store.setLastOpened(songId, null)) {
    practice.requestFreshLoad()
    await router.push({ name: 'player' })
  }
}

function openBookmarks(songId: string): void {
  void router.push({ name: 'bookmarks', query: { song: songId } })
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
  window.addEventListener('keydown', onPageKeyDown)
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  void backup.run(async () => {
    await store.refresh()
    await Promise.all([store.refreshStorage(), bookmarks.refresh(), stats.refresh()])
    if (rows.value.some((e) => e.songId === currentSongId.value)) {
      selectedId.value = currentSongId.value
    }
    await revealSelected()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onPageKeyDown)
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
        <HomeLink />
        <ManageTabs active="library" />
        <SearchField
          v-model="search"
          label="Search library"
          data-list-search
          data-testid="search"
        />
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
              :data-filter-cursor="shownCursor === s.value"
              :data-testid="`source-${s.value}`"
              @click="chooseSource(s.value)"
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
                :data-filter-cursor="shownCursor === `tag:${tag}`"
                :data-testid="`tag-filter-${tag}`"
                @click="clickTag(tag)"
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
          <p v-if="currentHidden" class="current-hidden" data-testid="current-hidden">
            Current song is hidden by the filter ·
            <button type="button" class="link" data-testid="current-show" @click="showCurrent">
              Show
            </button>
          </p>
          <div
            ref="songList"
            class="rows"
            role="listbox"
            tabindex="0"
            aria-label="Songs"
            :aria-activedescendant="selectedId ? `song-${selectedId}` : undefined"
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
                :key="`${group.label}/${e.songId}/${e.songId === pulseId ? pulseKey : 0}`"
                role="option"
                :title="e.title"
                :subtitle="bookmarkCount(e.songId)"
                :selected="e.songId === selectedId"
                :aria-selected="e.songId === selectedId"
                :tag="newSongIds.has(e.songId) ? 'New' : ''"
                :pulse="e.songId === pulseId"
                :data-pulse="e.songId === pulseId ? 'true' : undefined"
                data-testid="song-row"
                @click="selectedId = e.songId"
                @dblclick="play(e.songId)"
              >
                <span class="cell-text composer" :title="e.composer">{{ e.composer }}</span>
                <span class="num">{{ formatTime(e.facts.durationSeconds) }}</span>
                <span class="num" data-testid="row-plays">{{
                  formatPlays(stats.song(e.songId).plays)
                }}</span>
                <span class="num muted" data-testid="row-last">{{
                  formatLastPracticed(stats.song(e.songId).lastPlayedAt, stats.now)
                }}</span>
                <span class="num muted added" data-testid="row-added">{{
                  formatAddedAt(e.addedAt, now)
                }}</span>
              </SongRow>
            </div>
          </div>
          <p
            v-if="store.loaded && store.visible.length === 0"
            class="empty"
            data-testid="library-empty"
          >
            {{ emptyText }}
          </p>
          <button type="button" class="drop-zone" @click="uploadInput?.click()">
            Drop .mid files anywhere to add them
          </button>
        </section>

        <SongDetailsPanel
          v-if="selectedId !== null"
          :song-id="selectedId"
          @close="selectedId = rows[0]?.songId ?? null"
          @play="selectedId !== null && play(selectedId)"
          @bookmarks="selectedId !== null && openBookmarks(selectedId)"
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

.source[data-filter-cursor='true'] {
  box-shadow: inset 3px 0 0 var(--primary);
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

.chip[data-filter-cursor='true'] {
  outline: 2px solid rgb(var(--primary-rgb) / 55%);
  outline-offset: 2px;
}

.storage {
  margin: auto 0 0;
  color: var(--text-3);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.list {
  --song-columns: minmax(0, 2.2fr) minmax(0, 1.6fr) 64px 56px 64px 72px;
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

.current-hidden {
  margin: 0;
  padding: var(--space-2) 18px;
  color: var(--text-2);
  font-size: var(--text-sm);
}

.current-hidden .link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--secondary);
  font: inherit;
  cursor: pointer;
}

.current-hidden .link:hover,
.current-hidden .link:focus-visible {
  text-decoration: underline;
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
    /* Added is hidden below 1100 px (decision 73). */
    --song-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) 52px 44px 60px;
    --song-row-padding: 12px 14px;
  }

  .added,
  .table-head > :last-child {
    display: none;
  }

  .table-head {
    padding: 12px 14px;
  }
}
</style>
