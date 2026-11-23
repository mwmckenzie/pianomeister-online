<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'

import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { Bookmark } from '@/core/practice/Bookmark'
import type { BookmarkEdit } from '@/core/practice/BookmarkEdit'
import { autoBookmarkName } from '@/core/practice/bookmarkNames'
import { bookmarkSummary } from '@/core/practice/bookmarkSummary'
import { clampRange } from '@/core/practice/clampRange'
import { editBookmark } from '@/core/practice/editBookmark'
import { formatLastPracticed } from '@/core/stats/formatLastPracticed'
import { formatPlays } from '@/core/stats/formatPlays'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import AppIcon from '../components/AppIcon.vue'
import HomeLink from '../components/HomeLink.vue'
import RangeBar from '../components/RangeBar.vue'
import SearchField from '../components/SearchField.vue'
import BookmarkEditPanel from '../library/BookmarkEditPanel.vue'
import ManageTabs from '../library/ManageTabs.vue'
import { manageTabStep } from '../library/manageTabStep'
import { sceneSnapshot } from '../playback/sceneSnapshot'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { usePracticeStore } from '../stores/practiceStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useStatsStore } from '../stores/statsStore'
import { pageListCommand } from '../input/pageListCommand'
import { useToastStore } from '../stores/toastStore'
import { useUiStateStore } from '../stores/uiStateStore'

/**
 * The bookmark manager (docs/design/m6/source/QGBookmarks.dc.html, brief decision 69): songs
 * with bookmarks on the left, their bookmarks grouped by song in the middle, and the selected
 * one's edit panel on the right. `?song=` filters to a song, `?bookmark=` selects one, and
 * `&focus=name` puts the cursor in its name (the save toast's Rename). Bookmarks are made in
 * the player; Full song isn't listed here. Bookmarks of songs that are no longer in the library
 * are hidden, not deleted (decision 74).
 *
 * Duplicate makes a draft that lives only here, not in the database, until an edit makes its
 * settings differ from every bookmark; then it's saved. Leaving an unchanged draft asks first.
 */
const route = useRoute()
const router = useRouter()
const library = useLibraryStore()
const bookmarks = useBookmarkStore()
const stats = useStatsStore()
const toasts = useToastStore()
const practice = usePracticeStore()
const settings = useSettingsStore()
const panel = useTemplateRef<InstanceType<typeof BookmarkEditPanel>>('panel')

const search = ref('')
const songFilter = ref<string | null>(null)
const selectedId = ref<string | null>(null)

/** An unsaved duplicate and the name of the bookmark it was copied from. */
const ui = useUiStateStore()
const draft = shallowRef<{
  readonly bookmark: Bookmark
  readonly sourceId: string
  readonly sourceName: string
} | null>(null)
// A draft is unsaved work: Home on a new session waits for it (milestone 9.2 D).
watch(draft, (d) => ui.setUnsaved('bookmarkDraft', d !== null))
onBeforeUnmount(() => ui.setUnsaved('bookmarkDraft', false))

const songsById = computed(() => new Map(library.entries.map((e) => [e.songId, e])))

/** Songs that have bookmarks (and are still in the library), in library title order. */
const songsWithBookmarks = computed(() =>
  library.entries
    .filter((e) => bookmarks.forSong(e.songId).length > 0)
    .map((song) => ({ song, count: bookmarks.forSong(song.songId).length })),
)
const total = computed(() => songsWithBookmarks.value.reduce((n, s) => n + s.count, 0))

/** A song's bookmarks, with the draft right after the bookmark it copies. */
function rowsFor(songId: string): readonly Bookmark[] {
  const rows = bookmarks.forSong(songId)
  const d = draft.value
  if (d === null || d.bookmark.songId !== songId) return rows
  const at = rows.findIndex((b) => b.id === d.sourceId)
  const copy = [...rows]
  copy.splice(at < 0 ? rows.length : at + 1, 0, d.bookmark)
  return copy
}

interface Group {
  readonly song: LibraryEntry
  readonly bookmarks: readonly Bookmark[]
}

const groups = computed((): Group[] => {
  const query = search.value.trim().toLocaleLowerCase()
  const songs =
    songFilter.value === null
      ? songsWithBookmarks.value.map((s) => s.song)
      : [songsById.value.get(songFilter.value)].filter((s): s is LibraryEntry => s !== undefined)
  return songs.flatMap((song) => {
    const all = rowsFor(song.songId)
    const songMatches = query === '' || song.title.toLocaleLowerCase().includes(query)
    const marks = songMatches ? all : all.filter((b) => b.name.toLocaleLowerCase().includes(query))
    return marks.length > 0 ? [{ song, bookmarks: marks }] : []
  })
})

const selection = computed(() => {
  const id = selectedId.value
  for (const group of groups.value) {
    const found = group.bookmarks.find((b) => b.id === id)
    if (found !== undefined) return { song: group.song, bookmark: found }
  }
  const first = groups.value[0]
  const bookmark = first?.bookmarks[0]
  return first === undefined || bookmark === undefined ? null : { song: first.song, bookmark }
})

function isDraft(b: Bookmark | undefined): boolean {
  return b !== undefined && draft.value !== null && b.id === draft.value.bookmark.id
}

/** Another bookmark with the same settings (brief decision 69). */
function twinOf(b: Bookmark): Bookmark | null {
  return bookmarks.findSame(b, b.id)
}

/** What the panel notes: a draft's origin, and a twin other than the bookmark it copies. */
const notes = computed(() => {
  const b = selection.value?.bookmark
  if (b === undefined) return { duplicateOf: null, sameAs: null }
  const twin = twinOf(b)
  const d = draft.value
  const duplicateOf = d !== null && isDraft(b) ? d.sourceName : null
  const sameAs =
    twin === null || (d !== null && isDraft(b) && twin.id === d.sourceId) ? null : twin.name
  return { duplicateOf, sameAs }
})

function lastBar(song: LibraryEntry): number {
  return Math.max(1, song.bars)
}

function summary(bookmark: Bookmark, song: LibraryEntry): string {
  return bookmarkSummary(
    { ...bookmark.config, loop: clampRange(bookmark.config.loop, 1, lastBar(song)) },
    lastBar(song),
  )
}

function readQuery(): void {
  const song = route.query.song
  const bookmark = route.query.bookmark
  songFilter.value = typeof song === 'string' && song !== '' ? song : null
  if (typeof bookmark === 'string' && bookmark !== '') selectedId.value = bookmark
  else if (songFilter.value !== null) {
    selectedId.value = bookmarks.forSong(songFilter.value)[0]?.id ?? null
  }
  if (route.query.focus === 'name') void nextTick(() => panel.value?.focusName())
}

watch(() => route.query, readQuery)

/** The leave dialog's answer, while it's open. */
const leaving = shallowRef<((discard: boolean) => void) | null>(null)
const leaveOpen = computed({
  get: () => leaving.value !== null,
  // Esc or the backdrop: keep editing.
  set: (open: boolean) => {
    if (!open) answerLeave(false)
  },
})
const leaveTwin = computed(() => {
  const d = draft.value
  return d === null ? '' : (twinOf(d.bookmark)?.name ?? d.sourceName)
})

/**
 * Leaving an unchanged draft asks first: "Discard duplicate" drops it and goes on, "Keep
 * editing" stays. A draft that differs is saved already, so there's nothing to ask.
 */
function confirmLeave(): Promise<boolean> {
  if (draft.value === null) return Promise.resolve(true)
  return new Promise((resolve) => {
    leaving.value = resolve
  })
}

function answerLeave(discard: boolean): void {
  const resolve = leaving.value
  leaving.value = null
  if (discard) draft.value = null
  resolve?.(discard)
}

onBeforeRouteLeave(() => confirmLeave())
onBeforeRouteUpdate(() => confirmLeave())

function showSong(songId: string | null): void {
  void router.replace({ name: 'bookmarks', query: songId === null ? {} : { song: songId } })
}

async function select(id: string): Promise<void> {
  if (draft.value !== null && id !== draft.value.bookmark.id && !(await confirmLeave())) return
  selectedId.value = id
}

/** Scrolls the new selection into view; focus follows if it was on a row of the same list. */
async function reveal(rowSelector: string, change: () => Promise<unknown>): Promise<void> {
  const hadFocus = document.activeElement?.closest(rowSelector) != null
  await change()
  await nextTick()
  const el = document.querySelector<HTMLElement>(`${rowSelector}[aria-pressed="true"]`)
  el?.scrollIntoView({ block: 'nearest' })
  if (hadFocus) el?.focus()
}

/** ↑/↓ move the selection through the bookmarks shown (the main list). */
async function moveBookmark(by: number): Promise<void> {
  const rows = groups.value.flatMap((g) => g.bookmarks)
  const index = rows.findIndex((b) => b.id === selection.value?.bookmark.id)
  const next = rows[Math.min(rows.length - 1, Math.max(0, index + by))]
  if (next === undefined || next.id === selection.value?.bookmark.id) return
  await reveal('[data-testid="bookmark-row"]', () => select(next.id))
}

/** Shift+↑/↓ move the song filter (the side list); it applies at once, like a click. */
async function moveFilter(by: number): Promise<void> {
  const items = [null, ...songsWithBookmarks.value.map((s) => s.song.songId)]
  const index = items.indexOf(songFilter.value)
  const next = items[Math.min(items.length - 1, Math.max(0, index + by))]
  if (next === undefined || next === songFilter.value) return
  await reveal('.filters .filter', () =>
    router.replace({ name: 'bookmarks', query: next === null ? {} : { song: next } }),
  )
}

/** List keys by role, wherever focus is on the page (brief decisions 90–91). */
function onPageKeyDown(event: KeyboardEvent): void {
  const command = pageListCommand(event, settings.bindings)
  switch (command) {
    case 'listNext':
    case 'listPrevious':
      void moveBookmark(command === 'listNext' ? 1 : -1)
      break
    case 'secondaryNext':
    case 'secondaryPrevious':
      void moveFilter(command === 'secondaryNext' ? 1 : -1)
      break
    case 'listOpen':
      void loadInPlayer()
      break
    case 'nextTab':
    case 'previousTab':
      // Library | Bookmarks | Playlists: the tabs wrap.
      void router.push({ name: manageTabStep('bookmarks', command === 'nextTab' ? 1 : -1) })
      break
    default:
      return
  }
  event.preventDefault()
}

onMounted(() => window.addEventListener('keydown', onPageKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onPageKeyDown))

async function loadInPlayer(): Promise<void> {
  const s = selection.value
  if (s === null) return
  let id = s.bookmark.id
  if (isDraft(s.bookmark)) {
    // The draft is the same as its twin: discarding it loads that one.
    const twin = twinOf(s.bookmark)
    if (twin === null || !(await confirmLeave())) return
    id = twin.id
  }
  if (await library.setLastOpened(s.song.songId, id)) {
    practice.requestFreshLoad()
    await router.push({ name: 'player' })
  }
}

/**
 * "Open in editor" (brief decision 106): the loop editor over the player, with this bookmark
 * selected. If its song isn't the one loaded, that song loads first as Full song (nothing of
 * the bookmark applied); if it is, what's loaded stays as it is.
 */
async function openInEditor(): Promise<void> {
  const s = selection.value
  if (s === null || isDraft(s.bookmark)) return
  if (practice.songId !== s.song.songId) {
    if (!(await library.setLastOpened(s.song.songId, null))) return
    practice.requestFreshLoad()
  }
  await router.push({ name: 'editor', query: { bookmark: s.bookmark.id } })
}

/** A copy that's only kept once something about it changes. */
function duplicate(): void {
  const source = selection.value?.bookmark
  if (source === undefined || isDraft(source)) return
  const now = Date.now()
  const copy: Bookmark = {
    ...source,
    id: crypto.randomUUID(),
    name: autoBookmarkName(source.config),
    autoName: true,
    createdAt: now,
    updatedAt: now,
  }
  draft.value = { bookmark: copy, sourceId: source.id, sourceName: source.name }
  selectedId.value = copy.id
  void nextTick(() => panel.value?.focusName())
}

/** Edits from the panel: saved at once, or, for a draft, kept until it differs. */
async function edit(change: BookmarkEdit): Promise<void> {
  const b = selection.value?.bookmark
  if (b === undefined) return
  const d = draft.value
  if (d === null || !isDraft(b)) {
    await bookmarks.update(b.id, change)
    return
  }
  const next = editBookmark(d.bookmark, change, Date.now())
  draft.value = { ...d, bookmark: next }
  if (bookmarks.findSame(next) !== null) return
  await bookmarks.create(next.songId, next.config, {
    id: next.id,
    name: next.autoName ? undefined : next.name,
  })
  if (draft.value?.bookmark.id === next.id) draft.value = null
}

async function remove(): Promise<void> {
  const b = selection.value?.bookmark
  if (b === undefined) return
  if (isDraft(b)) {
    draft.value = null
    return
  }
  const siblings = bookmarks.forSong(b.songId)
  const index = siblings.findIndex((x) => x.id === b.id)
  const removed = await bookmarks.remove(b.id)
  if (removed === null) return
  selectedId.value = (siblings[index + 1] ?? siblings[index - 1])?.id ?? null
  toasts.showUndo(`Deleted “${removed.name}”`, () => {
    void bookmarks.restore(removed).then(() => (selectedId.value = removed.id))
  })
}

const backdrop = computed(() =>
  sceneSnapshot.value === null ? undefined : { backgroundImage: `url(${sceneSnapshot.value})` },
)

onMounted(async () => {
  await Promise.all([
    library.loaded ? null : library.refresh(),
    bookmarks.refresh(),
    stats.refresh(),
  ])
  readQuery()
})
</script>

<template>
  <main class="bookmarks-page">
    <div
      class="backdrop"
      :class="{ snapshot: backdrop !== undefined }"
      :style="backdrop"
      aria-hidden="true"
    />
    <div class="window glass" data-testid="bookmark-manager">
      <header class="top">
        <RouterLink :to="{ name: 'player' }" class="back" data-testid="back-to-player">
          <AppIcon name="chevronLeft" :size="18" /> Player
        </RouterLink>
        <HomeLink />
        <ManageTabs active="bookmarks" />
        <SearchField
          v-model="search"
          label="Search bookmarks or songs"
          placeholder="Search bookmarks or songs"
          data-list-search
          data-testid="bookmark-search"
        />
      </header>

      <div class="body">
        <aside class="filters" aria-label="Show">
          <h2 class="section-caps">Show</h2>
          <button
            type="button"
            class="filter"
            :aria-pressed="songFilter === null"
            data-testid="filter-all"
            @click="showSong(null)"
          >
            <span class="filter-name">All bookmarks</span>
            <span class="count">{{ total }}</span>
          </button>
          <button
            v-for="s in songsWithBookmarks"
            :key="s.song.songId"
            type="button"
            class="filter"
            :aria-pressed="songFilter === s.song.songId"
            :title="s.song.title"
            data-testid="filter-song"
            @click="showSong(s.song.songId)"
          >
            <span class="filter-name">{{ s.song.title }}</span>
            <span class="count">{{ s.count }}</span>
          </button>
        </aside>

        <section class="list" aria-label="Bookmarks">
          <div v-for="group in groups" :key="group.song.songId" class="group" role="group">
            <h3 class="group-head" :title="group.song.title" data-testid="bookmark-group">
              {{ group.song.title }} · {{ group.song.bars }} bars
            </h3>
            <button
              v-for="b in group.bookmarks"
              :key="b.id"
              type="button"
              class="row"
              :class="{ selected: selection?.bookmark.id === b.id, draft: isDraft(b) }"
              :aria-pressed="selection?.bookmark.id === b.id"
              data-testid="bookmark-row"
              data-list-row
              :data-draft="isDraft(b) ? 'true' : undefined"
              @click="select(b.id)"
            >
              <span class="name-cell">
                <span class="name" :title="b.name" data-testid="bookmark-row-name">{{
                  b.name
                }}</span>
                <span v-if="isDraft(b)" class="summary" data-testid="bookmark-row-draft"
                  >Unsaved duplicate</span
                >
                <span v-else-if="!b.autoName" class="summary" data-testid="bookmark-row-summary">{{
                  summary(b, group.song)
                }}</span>
              </span>
              <RangeBar
                :start="clampRange(b.config.loop, 1, lastBar(group.song)).startBar"
                :end="clampRange(b.config.loop, 1, lastBar(group.song)).endBar"
                :total="lastBar(group.song)"
                :height="6"
              />
              <span class="num" data-testid="bookmark-row-plays">{{
                formatPlays(stats.entry(b.id).plays, true)
              }}</span>
              <span class="num">{{ formatPracticeTime(stats.entry(b.id).playedMs) }}</span>
              <span class="num muted">{{
                formatLastPracticed(stats.entry(b.id).lastPlayedAt, stats.now)
              }}</span>
            </button>
          </div>
          <p v-if="groups.length === 0" class="empty" data-testid="bookmarks-empty">
            <template v-if="search">No bookmarks match.</template>
            <template v-else
              >No bookmarks yet. In the player, set up the loop, tempo and hands you want and press
              <span class="inline-icon" role="img" aria-label="Save as bookmark"
                ><AppIcon name="bookmarkAdd" :size="16" /></span
              >or B.</template
            >
          </p>
        </section>

        <BookmarkEditPanel
          v-if="selection"
          ref="panel"
          :key="selection.song.songId"
          :song="selection.song"
          :bookmark="selection.bookmark"
          :duplicate-of="notes.duplicateOf"
          :same-as="notes.sameAs"
          :is-draft="isDraft(selection.bookmark)"
          @edit="edit"
          @load="loadInPlayer"
          @open-editor="openInEditor"
          @duplicate="duplicate"
          @delete="remove"
        />
      </div>
    </div>

    <AppDialog
      v-model:open="leaveOpen"
      title="Discard this duplicate?"
      show-title
      width="460px"
      data-testid="discard-duplicate"
    >
      <p class="dialog-text" data-testid="discard-duplicate-text">
        It has the same settings as “{{ leaveTwin }}”, so it won’t be kept unless you change
        something.
      </p>
      <template #footer>
        <!-- First, so it has the focus: Enter keeps editing. -->
        <AppButton
          variant="primary"
          data-testid="discard-duplicate-keep"
          @click="answerLeave(false)"
        >
          Keep editing
        </AppButton>
        <AppButton danger data-testid="discard-duplicate-confirm" @click="answerLeave(true)">
          Discard duplicate
        </AppButton>
      </template>
    </AppDialog>
  </main>
</template>

<style scoped>
.bookmarks-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--bg);
}

.backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 50% 110%, rgb(40 70 140 / 25%), transparent 60%),
    linear-gradient(180deg, #05070f, #0a0f1e);
}

/* The same shell as the library page: the player's last frame, blurred, behind the glass. */
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
  align-items: center;
  gap: var(--space-3);
  padding: 14px 18px;
  border-bottom: 1px solid var(--divider);
}

.top :deep(.search-field) {
  flex: 1;
  min-width: 200px;
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
  gap: 2px;
  width: 190px;
  padding: 16px 12px;
  overflow-y: auto;
  border-right: 1px solid var(--divider);
}

.filters .section-caps {
  margin: 0 8px 8px;
}

.filter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.filter:hover {
  background: rgb(255 255 255 / 5%);
}

.filter[aria-pressed='true'] {
  background: rgb(var(--primary-rgb) / 14%);
  color: var(--text-1);
}

.filter-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
}

.list {
  flex: 1;
  min-width: 0;
  padding-bottom: var(--space-4);
  overflow-y: auto;
}

.group-head {
  margin: 0;
  padding: 16px 18px 6px;
  color: var(--text-4);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.group:first-child .group-head {
  padding-top: 10px;
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.4fr) 70px 70px 80px;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 18px;
  border: 0;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.row:hover {
  background: rgb(255 255 255 / 4%);
}

.row.selected {
  background: rgb(var(--primary-rgb) / 14%);
}

.row:focus-visible {
  outline: none;
  box-shadow: inset var(--focus-ring-field);
}

.row.draft .name {
  font-style: italic;
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  display: flex;
  gap: 6px;
  align-items: center;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary {
  overflow: hidden;
  color: var(--text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.num {
  color: var(--text-2);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.muted {
  color: var(--text-3);
}

.empty {
  padding: var(--space-6) 18px;
  color: var(--text-3);
}

.inline-icon {
  display: inline-grid;
  margin: 0 2px;
  color: var(--text-1);
  vertical-align: -3px;
}

/* 1024 px: the side panels keep their widths, the rows tighten. */
@media (width < 1100px) {
  .row {
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) 58px 58px 64px;
    gap: 8px;
    padding: 12px 14px;
  }
}
</style>
