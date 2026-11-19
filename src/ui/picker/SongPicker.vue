<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { summariseHandNotes } from '@/core/hands/summariseHandNotes'
import { formatTempoRange } from '@/core/library/formatTempoRange'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { LibrarySortField } from '@/core/library/LibrarySortField'
import { matchesSearch } from '@/core/library/matchesSearch'
import { sortEntries } from '@/core/library/sortEntries'
import { noteName } from '@/core/noteName'
import { bookmarkSummary } from '@/core/practice/bookmarkSummary'
import { clampRange } from '@/core/practice/clampRange'
import { fullSongId } from '@/core/practice/fullSongId'
import type { PracticeConfig } from '@/core/practice/PracticeConfig'
import { fullSongConfig } from '@/core/practice/practiceDefaults'
import { comparePractice } from '@/core/stats/comparePractice'
import { formatLastPracticed } from '@/core/stats/formatLastPracticed'
import { formatPlayedTimes, formatPlays, formatShare } from '@/core/stats/formatPlays'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'
import type { PracticeSortField } from '@/core/stats/PracticeSortField'
import type { PracticeTotals } from '@/core/stats/PracticeTotals'
import type { MeterSummary } from '@/core/timing/MeterSummary'
import type { LoopRange } from '@/core/transport/LoopRange'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import AppIcon from '../components/AppIcon.vue'
import IconButton from '../components/IconButton.vue'
import MeterReadout from '../components/MeterReadout.vue'
import PracticeChart from '../components/PracticeChart.vue'
import RangeBar from '../components/RangeBar.vue'
import SearchField from '../components/SearchField.vue'
import SongRow from '../components/SongRow.vue'
import SortableHeader from '../components/SortableHeader.vue'
import StatsTriple from '../components/StatsTriple.vue'
import { formatTime } from '../format/formatTime'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { pageListCommand } from '../input/pageListCommand'
import { useWindowKeys } from '../input/useWindowKeys'
import { useStatsStore } from '../stores/statsStore'

/**
 * "What to practice" (brief decisions 57 and 72): songs with their practice columns on the
 * left, the highlighted song's facts and stats in the middle, and what to load on the right —
 * Full song pinned first, then the song's bookmarks. Sizes follow
 * docs/design/m6/source/QGPicker.dc.html. Everything comes from the library entries, the
 * bookmarks and the play log already in memory, so nothing is parsed while browsing.
 */
type SongSort = Extract<LibrarySortField, 'title' | 'composer' | PracticeSortField>
type LoadSort = Exclude<PracticeSortField, 'bookmarks'>

interface LoadEntry {
  /** A bookmark id, or `full:<songId>`. */
  readonly id: string
  readonly bookmarkId: string | null
  readonly name: string
  /** The name is the summary (brief decision 69): no summary line under it then. */
  readonly autoName: boolean
  readonly range: LoopRange
  readonly config: PracticeConfig
  readonly totals: PracticeTotals
}

const props = defineProps<{ readonly currentSongId: string | null }>()
const emit = defineEmits<{
  load: [songId: string, bookmarkId: string | null]
  openLibrary: []
}>()
const open = defineModel<boolean>('open', { required: true })

const store = useLibraryStore()
const bookmarks = useBookmarkStore()
const stats = useStatsStore()
const settings = useSettingsStore()
const search = ref('')
const sortField = ref<SongSort>('last')
const sortDirection = ref<'asc' | 'desc'>('desc')
const loadSort = ref<LoadSort | null>(null)
const loadDirection = ref<'asc' | 'desc'>('desc')
const highlightedId = ref<string | null>(null)
const selectedEntryId = ref<string | null>(null)
const searchField = useTemplateRef<{ focus: () => void }>('searchField')
const songList = useTemplateRef<HTMLElement>('songList')
const loadList = useTemplateRef<HTMLElement>('loadList')
const root = useTemplateRef<HTMLElement>('root')

const songs = computed(() =>
  sortEntries(
    store.entries.filter((e) => matchesSearch(e, search.value)),
    sortField.value,
    sortDirection.value,
    stats.songRows,
  ),
)
const highlighted = computed(
  () => songs.value.find((e) => e.songId === highlightedId.value) ?? songs.value[0] ?? null,
)

function lastBar(entry: LibraryEntry): number {
  return Math.max(1, entry.bars)
}

/** Full song pinned first, then the song's bookmarks (in the chosen order). */
const entries = computed((): LoadEntry[] => {
  const song = highlighted.value
  if (song === null) return []
  const last = lastBar(song)
  const full: LoadEntry = {
    id: fullSongId(song.songId),
    bookmarkId: null,
    name: 'Full song',
    autoName: false,
    range: { startBar: 1, endBar: last },
    config: fullSongConfig(settings.settings),
    totals: stats.entry(fullSongId(song.songId)),
  }
  const marks = bookmarks.forSong(song.songId).map((b): LoadEntry => ({
    id: b.id,
    bookmarkId: b.id,
    name: b.name,
    autoName: b.autoName,
    range: clampRange(b.config.loop, 1, last),
    config: b.config,
    totals: stats.entry(b.id),
  }))
  const field = loadSort.value
  if (field !== null) {
    marks.sort(
      (a, b) =>
        comparePractice(a.totals, b.totals, field, loadDirection.value) ||
        a.name.localeCompare(b.name),
    )
  }
  return [full, ...marks]
})
const selectedEntry = computed(
  () => entries.value.find((e) => e.id === selectedEntryId.value) ?? entries.value[0] ?? null,
)

/** The file's meter, or the override's single meter (then there are no changes). */
const meter = computed((): MeterSummary => {
  const entry = highlighted.value
  if (entry?.override === null && entry.facts.meter !== undefined) return entry.facts.meter
  const main = entry?.timeSignature ?? '4/4'
  return { main, changes: 0, runs: [{ bar: 1, meter: main }] }
})
const notes = computed(() => {
  const entry = highlighted.value
  const channels = entry?.facts.channels
  return entry === null || channels === undefined ? null : summariseHandNotes(channels, entry.hands)
})
const pitchRange = computed(() => {
  const n = notes.value
  if (n === null || n.lowest === null || n.highest === null) return '—'
  return `${noteName(n.lowest)}–${noteName(n.highest)}`
})

const songStats = computed(() => {
  const song = highlighted.value
  if (song === null) return null
  const totals = stats.song(song.songId)
  return {
    items: [
      {
        label: 'Played',
        value: formatPlayedTimes(totals.plays),
        testid: 'picker-song-played',
      },
      {
        label: 'Practice',
        value: formatPracticeTime(totals.playedMs),
        testid: 'picker-song-practice',
      },
      {
        label: 'Last',
        value: formatLastPracticed(totals.lastPlayedAt, stats.now),
        testid: 'picker-song-last',
      },
    ],
    chart: stats.chart({ songId: song.songId }),
  }
})

const entryStats = computed(() => {
  const song = highlighted.value
  const entry = selectedEntry.value
  if (song === null || entry === null) return null
  return {
    summary: bookmarkSummary({ ...entry.config, loop: entry.range }, lastBar(song), {
      alwaysHands: true,
    }),
    items: [
      {
        label: 'Played',
        value: formatPlayedTimes(entry.totals.plays),
        testid: 'picker-entry-played',
      },
      {
        label: 'Practice',
        value: formatPracticeTime(entry.totals.playedMs),
        testid: 'picker-entry-practice',
      },
      {
        label: 'Share',
        value: formatShare(stats.share(entry.id, song.songId)),
        testid: 'picker-entry-share',
      },
    ],
    chart: stats.chart({ entryId: entry.id }),
  }
})

watch(
  open,
  async (isOpen) => {
    if (!isOpen) return
    search.value = ''
    highlightedId.value = props.currentSongId
    selectedEntryId.value = null
    if (!store.loaded) await store.refresh()
    await Promise.all([bookmarks.refresh(), stats.refresh()])
    await nextTick()
    searchField.value?.focus()
  },
  { immediate: true },
)

watch(songs, (list) => {
  // Keep the highlight on a visible song while searching; with no match, keep it for later.
  const first = list[0]
  if (first !== undefined && !list.some((e) => e.songId === highlightedId.value)) {
    highlightedId.value = first.songId
  }
})

// Another song: its Full song is selected (decision 72).
watch(
  () => highlighted.value?.songId,
  () => (selectedEntryId.value = null),
)

function sortBy(field: SongSort): void {
  if (sortField.value === field)
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  else {
    sortField.value = field
    // Text sorts A–Z first; practice columns most (or most recent) first.
    sortDirection.value = field === 'title' || field === 'composer' ? 'asc' : 'desc'
  }
}

function sortLoad(field: LoadSort): void {
  if (loadSort.value === field) loadDirection.value = loadDirection.value === 'asc' ? 'desc' : 'asc'
  else {
    loadSort.value = field
    loadDirection.value = 'desc'
  }
}

function scrollSelected(list: HTMLElement | null): void {
  void nextTick(() =>
    list?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }),
  )
}

function move(step: number): void {
  const list = songs.value
  if (list.length === 0) return
  const index = list.findIndex((e) => e.songId === highlighted.value?.songId)
  const next = list[Math.min(list.length - 1, Math.max(0, index + step))]
  highlightedId.value = next?.songId ?? null
  scrollSelected(songList.value)
}

function moveEntry(step: number): void {
  const list = entries.value
  const index = list.findIndex((e) => e.id === selectedEntry.value?.id)
  selectedEntryId.value = list[Math.min(list.length - 1, Math.max(0, index + step))]?.id ?? null
  scrollSelected(loadList.value)
}

function load(): void {
  const song = highlighted.value
  if (song !== null) emit('load', song.songId, selectedEntry.value?.bookmarkId ?? null)
}

/**
 * List keys by role (brief decisions 90–91), wherever focus is in the picker: ↑/↓ move the
 * songs, Shift+↑/↓ the Load list, ←/→ and [ / ] move focus between the two lists, Enter loads
 * the selected Load-list entry (Esc is the dialog's).
 */
function onKeyDown(event: KeyboardEvent): void {
  const command = pageListCommand(event, settings.bindings, root.value)
  switch (command) {
    case 'listNext':
    case 'listPrevious':
      move(command === 'listNext' ? 1 : -1)
      break
    case 'secondaryNext':
    case 'secondaryPrevious':
      moveEntry(command === 'secondaryNext' ? 1 : -1)
      break
    case 'listFocusNext':
    case 'nextTab':
      loadList.value?.focus()
      break
    case 'listFocusPrevious':
    case 'previousTab':
      songList.value?.focus()
      break
    case 'listOpen':
      load()
      break
    default:
      return
  }
  event.preventDefault()
}

useWindowKeys(() => open.value, onKeyDown)

const SONG_SORTS = [
  { field: 'plays', label: 'Plays' },
  { field: 'time', label: 'Time' },
  { field: 'last', label: 'Last' },
] as const
const LOAD_SORTS = SONG_SORTS
</script>

<template>
  <AppDialog
    v-model:open="open"
    title="What to practice"
    description="Choose a song and what to load"
    width="1180px"
    height="640px"
    data-testid="song-picker"
  >
    <div ref="root" class="picker">
      <header class="head">
        <h2 class="heading">What to practice</h2>
        <SearchField
          ref="searchField"
          v-model="search"
          label="Search songs"
          data-list-search
          data-testid="picker-search"
        />
        <IconButton icon="close" label="Close" variant="filled" @click="open = false" />
      </header>

      <div class="columns">
        <section class="songs" aria-label="Songs">
          <div class="list-head">
            <span class="title-sorts">
              <SortableHeader
                label="Title"
                :active="sortField === 'title'"
                :direction="sortDirection"
                data-testid="picker-sort-title"
                @sort="sortBy('title')"
              />
              <span class="dot" aria-hidden="true">·</span>
              <SortableHeader
                label="Composer"
                :active="sortField === 'composer'"
                :direction="sortDirection"
                data-testid="picker-sort-composer"
                @sort="sortBy('composer')"
              />
            </span>
            <SortableHeader
              label="Bookmarks"
              :active="sortField === 'bookmarks'"
              :direction="sortDirection"
              align="end"
              title="Bookmarks"
              data-testid="picker-sort-bookmarks"
              @sort="sortBy('bookmarks')"
            >
              <AppIcon name="bookmark" :size="13" />
              <span class="visually-hidden">Bookmarks</span>
            </SortableHeader>
            <SortableHeader
              v-for="s in SONG_SORTS"
              :key="s.field"
              :label="s.label"
              :active="sortField === s.field"
              :direction="sortDirection"
              align="end"
              plain
              :data-testid="`picker-sort-${s.field}`"
              @sort="sortBy(s.field)"
            />
          </div>
          <ul
            ref="songList"
            class="list"
            role="listbox"
            tabindex="0"
            aria-label="Songs"
            :aria-activedescendant="highlighted ? `pick-${highlighted.songId}` : undefined"
          >
            <SongRow
              v-for="song in songs"
              :id="`pick-${song.songId}`"
              :key="song.songId"
              as="li"
              role="option"
              :title="song.title"
              :subtitle="song.composer || 'Unknown composer'"
              :selected="song.songId === highlighted?.songId"
              :aria-selected="song.songId === highlighted?.songId"
              data-testid="picker-song"
              @click="highlightedId = song.songId"
              @dblclick="emit('load', song.songId, null)"
            >
              <span class="num" :class="{ muted: !bookmarks.forSong(song.songId).length }">{{
                bookmarks.forSong(song.songId).length || '—'
              }}</span>
              <span class="num" data-testid="picker-song-plays">{{
                formatPlays(stats.song(song.songId).plays)
              }}</span>
              <span class="num" data-testid="picker-song-time">{{
                formatPracticeTime(stats.song(song.songId).playedMs)
              }}</span>
              <span class="num last" data-testid="picker-song-lastcell">{{
                formatLastPracticed(stats.song(song.songId).lastPlayedAt, stats.now)
              }}</span>
            </SongRow>
            <li v-if="songs.length === 0" class="empty">No songs match “{{ search }}”.</li>
          </ul>
        </section>

        <section class="details" aria-label="Song details" data-testid="picker-details">
          <template v-if="highlighted">
            <div>
              <h3 class="detail-title" :title="highlighted.title">{{ highlighted.title }}</h3>
              <p class="detail-sub">
                {{ highlighted.composer || 'Unknown composer' }} ·
                {{ highlighted.source === 'bundled' ? 'Bundled' : 'Uploaded' }}
              </p>
            </div>
            <dl class="facts">
              <div>
                <dt>Length</dt>
                <dd>{{ formatTime(highlighted.facts.durationSeconds) }}</dd>
              </div>
              <div>
                <dt>Bars</dt>
                <dd>{{ highlighted.bars }}</dd>
              </div>
              <div>
                <dt>Meter</dt>
                <dd data-testid="picker-meter">
                  <MeterReadout :summary="meter" />
                </dd>
              </div>
              <div>
                <dt>Tempo</dt>
                <dd class="nowrap" data-testid="picker-tempo">
                  {{ formatTempoRange(highlighted.facts) }}
                </dd>
              </div>
            </dl>
            <dl class="facts" data-testid="picker-notes">
              <div>
                <dt>Right hand</dt>
                <dd>{{ notes ? `${notes.right} notes` : '—' }}</dd>
              </div>
              <div>
                <dt>Left hand</dt>
                <dd>{{ notes ? `${notes.left} notes` : '—' }}</dd>
              </div>
              <div class="wide">
                <dt>Range</dt>
                <dd>{{ pitchRange }}</dd>
              </div>
            </dl>
            <div v-if="songStats" class="stats" data-testid="picker-song-stats">
              <StatsTriple :items="songStats.items" />
              <PracticeChart
                :minutes="songStats.chart"
                :label="`${highlighted.title}, practice per day`"
                data-testid="picker-song-chart"
              />
            </div>
            <hr class="divider" />
            <div v-if="entryStats && selectedEntry" class="stats" data-testid="picker-entry-stats">
              <div>
                <h4 class="entry-name" :title="selectedEntry.name" data-testid="picker-entry-name">
                  {{ selectedEntry.name }}
                </h4>
                <p
                  v-if="!selectedEntry.autoName"
                  class="entry-summary"
                  :title="entryStats.summary"
                  data-testid="picker-entry-summary"
                >
                  {{ entryStats.summary }}
                </p>
              </div>
              <StatsTriple :items="entryStats.items" />
              <PracticeChart
                :minutes="entryStats.chart"
                :label="`${selectedEntry.name}, practice per day`"
                data-testid="picker-entry-chart"
              />
            </div>
          </template>
        </section>

        <section class="load" aria-label="Load">
          <div class="list-head">
            <span class="section-caps">Load</span>
            <SortableHeader
              v-for="s in LOAD_SORTS"
              :key="s.field"
              :label="s.label"
              :active="loadSort === s.field"
              :direction="loadDirection"
              align="end"
              plain
              :data-testid="`picker-load-sort-${s.field}`"
              @sort="sortLoad(s.field)"
            />
          </div>
          <ul
            ref="loadList"
            class="list"
            role="listbox"
            tabindex="0"
            aria-label="What to load"
            :aria-activedescendant="selectedEntry ? `load-${selectedEntry.id}` : undefined"
          >
            <template v-for="(item, index) in entries" :key="item.id">
              <li
                :id="`load-${item.id}`"
                role="option"
                class="entry"
                :class="{ selected: item.id === selectedEntry?.id }"
                :aria-selected="item.id === selectedEntry?.id"
                :data-testid="item.bookmarkId === null ? 'picker-full-song' : 'picker-bookmark'"
                @click="selectedEntryId = item.id"
                @dblclick="((selectedEntryId = item.id), load())"
              >
                <span class="entry-main">
                  <span class="entry-head">
                    <span class="entry-title" :title="item.name">{{ item.name }}</span>
                    <span class="entry-range">{{
                      item.range.startBar === item.range.endBar
                        ? item.range.startBar
                        : `${item.range.startBar}–${item.range.endBar}`
                    }}</span>
                  </span>
                  <RangeBar
                    :start="item.range.startBar"
                    :end="item.range.endBar"
                    :total="highlighted ? lastBar(highlighted) : 1"
                    :soft="item.bookmarkId === null"
                  />
                </span>
                <span class="num">{{ formatPlays(item.totals.plays) }}</span>
                <span class="num">{{ formatPracticeTime(item.totals.playedMs) }}</span>
                <span class="num last">{{
                  formatLastPracticed(item.totals.lastPlayedAt, stats.now)
                }}</span>
              </li>
              <li v-if="index === 0" class="separator" role="presentation" />
            </template>
            <li v-if="highlighted && entries.length === 1" class="empty" role="presentation">
              No bookmarks yet. Set up the loop, tempo and hands you want and press
              <span class="inline-icon" role="img" aria-label="Save as bookmark"
                ><AppIcon name="bookmarkAdd" :size="15" /></span
              >or B.
            </li>
          </ul>
        </section>
      </div>

      <footer class="foot">
        <AppButton variant="text" data-testid="open-library" @click="emit('openLibrary')">
          Library…
        </AppButton>
        <span class="spacer" />
        <AppButton @click="open = false">Cancel</AppButton>
        <AppButton
          variant="primary"
          :disabled="highlighted === null"
          data-testid="picker-load"
          @click="load"
        >
          {{ selectedEntry?.bookmarkId ? 'Load bookmark' : 'Load full song' }}
        </AppButton>
      </footer>
    </div>
  </AppDialog>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 18px 22px;
  border-bottom: 1px solid var(--divider);
}

.heading {
  flex-shrink: 0;
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
}

.columns {
  display: flex;
  flex: 1;
  min-height: 0;
}

.songs,
.load {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
}

.songs {
  --song-columns: minmax(0, 1fr) 36px 50px 66px 74px;
  width: 440px;
  border-right: 1px solid var(--divider);
}

.load {
  --load-columns: minmax(0, 1fr) 36px 66px 66px;
  width: 380px;
  border-left: 1px solid var(--divider);
}

.load .list-head {
  grid-template-columns: var(--load-columns);
  gap: 8px;
}

.list-head {
  display: grid;
  grid-template-columns: var(--song-columns, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 41px;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--divider-soft);
}

.load .list-head {
  padding: 12px 14px 8px;
}

.last {
  white-space: nowrap;
}

.title-sorts {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.dot {
  color: var(--text-4);
}

.list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  list-style: none;
}

.list:focus-visible {
  box-shadow: inset var(--focus-ring-field);
}

.empty {
  padding: var(--space-4);
  color: var(--text-3);
  font-size: var(--text-sm);
}

.inline-icon {
  display: inline-grid;
  margin: 0 2px;
  color: var(--text-1);
  vertical-align: -3px;
}

.details {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  padding: 16px 18px;
  overflow-y: auto;
}

.detail-title {
  margin: 0;
  font-size: 19px;
  font-weight: var(--weight-medium);
  letter-spacing: -0.01em;
}

.detail-sub {
  margin: 2px 0 0;
  color: var(--text-3);
  font-size: var(--text-sm);
}

.facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  font-size: var(--text-sm);
}

.facts .wide {
  grid-column: span 2;
}

dt {
  color: var(--text-4);
  font-size: var(--text-2xs);
}

dd {
  margin: 0;
}

.nowrap {
  white-space: nowrap;
}

.entry {
  display: grid;
  grid-template-columns: var(--load-columns);
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: var(--text-md);
  cursor: pointer;
}

.entry:hover {
  background: rgb(255 255 255 / 4%);
}

.entry.selected {
  background: rgb(var(--primary-rgb) / 14%);
}

.entry-main {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.entry .num {
  white-space: nowrap;
  color: var(--text-2);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.separator {
  height: 1px;
  margin: 4px 14px;
  background: var(--divider-soft);
}

.stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.divider {
  width: 100%;
  margin: 2px 0;
  border: 0;
  border-top: 1px solid var(--divider);
}

.entry-name {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
}

.entry-summary {
  margin: 2px 0 0;
  color: var(--text-3);
  font-size: var(--text-sm);
}

.entry-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.entry-title {
  overflow: hidden;
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-range {
  flex-shrink: 0;
  color: var(--text-3);
  white-space: nowrap;
  font-size: var(--text-xs);
}

.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--divider);
}

.spacer {
  flex: 1;
}

/* Narrower windows (1024 px): the side columns shrink before the details do. */
@media (width < 1220px) {
  .songs {
    width: 400px;
  }

  .songs {
    --song-columns: minmax(0, 1fr) 26px 34px 62px 62px;
  }

  .load {
    --load-columns: minmax(0, 1fr) 28px 62px 60px;
    width: 300px;
  }
}
</style>
