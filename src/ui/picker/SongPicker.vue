<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { summariseHandNotes } from '@/core/hands/summariseHandNotes'
import { formatTempoRange } from '@/core/library/formatTempoRange'
import type { LibrarySortField } from '@/core/library/LibrarySortField'
import { matchesSearch } from '@/core/library/matchesSearch'
import { sortEntries } from '@/core/library/sortEntries'
import { noteName } from '@/core/noteName'
import type { MeterSummary } from '@/core/timing/MeterSummary'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import AppIcon from '../components/AppIcon.vue'
import IconButton from '../components/IconButton.vue'
import MeterReadout from '../components/MeterReadout.vue'
import RangeBar from '../components/RangeBar.vue'
import SearchField from '../components/SearchField.vue'
import SongRow from '../components/SongRow.vue'
import SortableHeader from '../components/SortableHeader.vue'
import { formatTime } from '../format/formatTime'
import { useLibraryStore } from '../stores/libraryStore'

/**
 * "What to practice" (decision 57): songs on the left, the highlighted song's details in the
 * middle, and what to load on the right — "Full song" now, bookmarks in milestone 7. Sizes follow
 * docs/design/m6/source/QGPicker.dc.html. Until milestone 7's stats, the middle column shows
 * notes per hand and the pitch range under the facts. Everything comes from the library entry
 * (stored facts and hands), so nothing is parsed while browsing.
 */
type PickerSort = Extract<LibrarySortField, 'title' | 'composer' | 'bars' | 'duration'>

const props = defineProps<{ readonly currentSongId: string | null }>()
const emit = defineEmits<{ load: [songId: string]; openLibrary: [] }>()
const open = defineModel<boolean>('open', { required: true })

const store = useLibraryStore()
const search = ref('')
const sortField = ref<PickerSort>('title')
const sortDirection = ref<'asc' | 'desc'>('asc')
const highlightedId = ref<string | null>(null)
const searchField = useTemplateRef<{ focus: () => void }>('searchField')
const songList = useTemplateRef<HTMLElement>('songList')
const loadList = useTemplateRef<HTMLElement>('loadList')

const songs = computed(() =>
  sortEntries(
    store.entries.filter((e) => matchesSearch(e, search.value)),
    sortField.value,
    sortDirection.value,
  ),
)
const highlighted = computed(
  () => songs.value.find((e) => e.songId === highlightedId.value) ?? songs.value[0] ?? null,
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

watch(
  open,
  async (isOpen) => {
    if (!isOpen) return
    search.value = ''
    highlightedId.value = props.currentSongId
    if (!store.loaded) await store.refresh()
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

function sortBy(field: PickerSort): void {
  if (sortField.value === field)
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  else {
    sortField.value = field
    // Text sorts A–Z first; numbers largest first.
    sortDirection.value = field === 'title' || field === 'composer' ? 'asc' : 'desc'
  }
}

function move(step: number): void {
  const list = songs.value
  if (list.length === 0) return
  const index = list.findIndex((e) => e.songId === highlighted.value?.songId)
  const next = list[Math.min(list.length - 1, Math.max(0, index + step))]
  highlightedId.value = next?.songId ?? null
  void nextTick(() =>
    songList.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }),
  )
}

function load(): void {
  const song = highlighted.value
  if (song !== null) emit('load', song.songId)
}

/** ↑/↓ move through the focused list, ←/→ switch lists, Enter loads (Esc is the dialog's). */
function onKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement
  const inLoadList = loadList.value?.contains(target) ?? false
  const inSearch = target instanceof HTMLInputElement
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      // The load list has one entry ("Full song") until bookmarks arrive.
      if (!inLoadList) move(event.key === 'ArrowDown' ? 1 : -1)
      break
    case 'ArrowRight':
      if (inSearch) return
      loadList.value?.focus()
      break
    case 'ArrowLeft':
      if (inSearch) return
      songList.value?.focus()
      break
    case 'Enter':
      // Buttons (Cancel, Library…, meter changes) handle their own Enter.
      if (target instanceof HTMLButtonElement) return
      load()
      break
    default:
      return
  }
  event.preventDefault()
}

const SORTS = [
  { field: 'bars', label: 'Bars' },
  { field: 'duration', label: 'Length' },
] as const
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
    <div class="picker" @keydown="onKeyDown">
      <header class="head">
        <h2 class="heading">What to practice</h2>
        <SearchField
          ref="searchField"
          v-model="search"
          label="Search songs"
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
            <span class="bookmark-head" title="Bookmarks (milestone 7)">
              <AppIcon name="bookmark" :size="13" />
              <span class="visually-hidden">Bookmarks</span>
            </span>
            <SortableHeader
              v-for="s in SORTS"
              :key="s.field"
              :label="s.label"
              :active="sortField === s.field"
              :direction="sortDirection"
              align="end"
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
              @dblclick="emit('load', song.songId)"
            >
              <span class="num muted">—</span>
              <span class="num">{{ song.bars }}</span>
              <span class="num">{{ formatTime(song.facts.durationSeconds) }}</span>
            </SongRow>
            <li v-if="songs.length === 0" class="empty">No songs match “{{ search }}”.</li>
          </ul>
        </section>

        <section class="details" aria-label="Song details" data-testid="picker-details">
          <template v-if="highlighted">
            <div>
              <h3 class="detail-title">{{ highlighted.title }}</h3>
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
                <dd data-testid="picker-meter"><MeterReadout :summary="meter" /></dd>
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
            <!-- Milestone 7: song stats and the selected entry's stats go here. -->
          </template>
        </section>

        <section class="load" aria-label="Load">
          <div class="list-head">
            <span class="section-caps">Load</span>
          </div>
          <ul ref="loadList" class="list" role="listbox" tabindex="0" aria-label="What to load">
            <li
              v-if="highlighted"
              role="option"
              class="entry"
              aria-selected="true"
              data-testid="picker-full-song"
              @dblclick="load"
            >
              <span class="entry-head">
                <span class="entry-title">Full song</span>
                <span class="entry-range">{{
                  highlighted.bars > 0 ? `1–${highlighted.bars}` : ''
                }}</span>
              </span>
              <RangeBar :start="1" :end="highlighted.bars" :total="highlighted.bars" />
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
          Load full song
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
  --song-columns: minmax(0, 1fr) 36px 50px 56px;
  width: 440px;
  border-right: 1px solid var(--divider);
}

.load {
  width: 380px;
  border-left: 1px solid var(--divider);
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

.title-sorts {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.dot {
  color: var(--text-4);
}

.bookmark-head {
  display: grid;
  justify-items: end;
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
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 14px;
  background: rgb(var(--primary-rgb) / 14%);
  font-size: var(--text-md);
  cursor: pointer;
}

.entry-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.entry-title {
  font-weight: var(--weight-medium);
}

.entry-range {
  color: var(--text-3);
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

  .load {
    width: 260px;
  }
}
</style>
