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
import { useRoute, useRouter } from 'vue-router'

import type { Look } from '@/core/looks/Look'
import { lookSwatch } from '@/core/looks/lookSwatch'
import { allLooks } from '@/core/looks/lookValues'
import type { Playlist } from '@/core/playlists/Playlist'
import type { PlaylistRepeat } from '@/core/playlists/PlaylistRepeat'
import { MAX_PLAYLIST_NAME } from '@/core/playlists/readPlaylist'
import { moveEntry } from '@/core/playlists/moveEntry'
import { readPlaylistFile } from '@/core/playlists/readPlaylistFile'
import { resolvePlaylist } from '@/core/playlists/resolvePlaylist'
import { toPlaylistFile } from '@/core/playlists/toPlaylistFile'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import AppIcon from '../components/AppIcon.vue'
import AppPopover from '../components/AppPopover.vue'
import HomeLink from '../components/HomeLink.vue'
import IconButton from '../components/IconButton.vue'
import SearchField from '../components/SearchField.vue'
import SelectField from '../components/SelectField.vue'
import { formatTime } from '../format/formatTime'
import { pageListCommand } from '../input/pageListCommand'
import ManageTabs from '../library/ManageTabs.vue'
import { manageTabStep } from '../library/manageTabStep'
import { sceneSnapshot } from '../playback/sceneSnapshot'
import { usePlaylistActions } from '../playlists/usePlaylistActions'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlaylistStore } from '../stores/playlistStore'
import { useProfileStore } from '../stores/profileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'

/**
 * The Playlists tab (milestone 9.5 B, board QGPlaylists): the profile's playlists on the left,
 * the selected one's editor in the middle (toolbar, songs with per-song looks, drag or Alt+↑/↓
 * to reorder), and the library to add songs from on the right. Every edit is saved at once.
 * `?playlist=` selects one; `&focus=name` puts the cursor in its name.
 */
const route = useRoute()
const router = useRouter()
const library = useLibraryStore()
const store = usePlaylistStore()
const profiles = useProfileStore()
const settings = useSettingsStore()
const toasts = useToastStore()
const actions = usePlaylistActions()
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const CURRENT = '__current'
const PLAYLIST_LOOK = '__playlist'

const selectedId = ref<string | null>(null)
const selectedRow = ref(0)
const search = ref('')
const menuOpen = ref(false)
/** The screen-reader announcement of a move. */
const announcement = ref('')

const songs = computed(() => new Map(library.entries.map((e) => [e.songId, e])))
const looks = computed(() => allLooks(settings.looks))
const looksById = computed(() => new Map(looks.value.map((l) => [l.id, l])))
const durations = computed(
  () => new Map(library.entries.map((e) => [e.songId, { durationSec: e.facts.durationSeconds }])),
)

const current = computed<Playlist | null>(
  () => store.byId.get(selectedId.value ?? '') ?? store.playlists[0] ?? null,
)

function lookOf(id: string | null): Look | null {
  return id === null ? null : (looksById.value.get(id) ?? null)
}
function lookName(id: string | null): string {
  return lookOf(id)?.name ?? 'Current look'
}
function swatch(id: string | null): string {
  const look = lookOf(id)
  return look === null ? 'transparent' : lookSwatch(look)
}

function meta(p: Playlist): string {
  const resolved = resolvePlaylist(p, durations.value, new Set(looksById.value.keys()))
  const n = p.entries.length
  return `${n} ${n === 1 ? 'song' : 'songs'} · ${formatTime(resolved.durationSec)}`
}
const headerMeta = computed(() =>
  current.value === null
    ? ''
    : `${meta(current.value)} · crossfade ${settings.settings.audio.crossfade} s`,
)

const lookOptions = computed(() => [
  { value: CURRENT, label: 'Current look (no change)' },
  ...looks.value.map((l) => ({
    value: l.id,
    label: l.name,
    group: l.builtIn ? 'Built-in' : 'My looks',
  })),
])
const rowLookOptions = computed(() => [
  { value: PLAYLIST_LOOK, label: `Playlist look (${lookName(current.value?.lookId ?? null)})` },
  ...looks.value.map((l) => ({
    value: l.id,
    label: l.name,
    group: l.builtIn ? 'Built-in' : 'My looks',
  })),
])
const REPEAT_OPTIONS: readonly { value: PlaylistRepeat; label: string }[] = [
  { value: 'playlist', label: 'Playlist' },
  { value: 'one', label: 'One song' },
  { value: 'off', label: 'Off' },
]

const rows = computed(() => {
  const p = current.value
  if (p === null) return []
  return p.entries.map((e, index) => {
    const song = songs.value.get(e.songId)
    return {
      index,
      entry: e,
      title: song?.title ?? 'Missing song',
      composer: song === undefined ? 'Not in this library' : song.composer || 'Unknown composer',
      missing: song === undefined,
      length: song === undefined ? '—' : formatTime(song.facts.durationSeconds),
      look: lookOf(e.lookId) === null ? PLAYLIST_LOOK : (e.lookId ?? PLAYLIST_LOOK),
      swatch: swatch(lookOf(e.lookId) === null ? p.lookId : e.lookId),
    }
  })
})

const inPlaylist = computed(() => new Set(current.value?.entries.map((e) => e.songId) ?? []))
const addable = computed(() => {
  const q = search.value.trim().toLocaleLowerCase()
  return library.entries.filter(
    (e) =>
      q === '' ||
      e.title.toLocaleLowerCase().includes(q) ||
      e.composer.toLocaleLowerCase().includes(q),
  )
})

// --- Editing (saved at once) ----------------------------------------------------------------

async function change(update: Partial<Playlist>): Promise<void> {
  const p = current.value
  if (p !== null) await store.save({ ...p, ...update })
}

/** The name being typed: a re-render (a library refresh, say) must not put the stored one back. */
const nameDraft = ref('')
watch(
  () => [current.value?.id, current.value?.name] as const,
  ([, name]) => (nameDraft.value = name ?? ''),
  { immediate: true },
)

function rename(): void {
  const p = current.value
  const value = nameDraft.value.trim().slice(0, MAX_PLAYLIST_NAME)
  if (p === null) return
  if (value === '' || value === p.name) {
    nameDraft.value = p.name
    return
  }
  void change({ name: value })
}

function setLook(value: string): void {
  void change({ lookId: value === CURRENT ? null : value })
}

function setRowLook(index: number, value: string): void {
  const p = current.value
  if (p === null) return
  const entries = p.entries.map((e, i) =>
    i === index ? { ...e, lookId: value === PLAYLIST_LOOK ? null : value } : e,
  )
  void change({ entries })
}

function move(from: number, to: number): void {
  const p = current.value
  if (p === null) return
  const entries = moveEntry(p.entries, from, to)
  if (entries === p.entries) return
  const at = entries.indexOf(p.entries[from]!)
  selectedRow.value = at
  void change({ entries })
  announcement.value = `Moved ${rows.value[from]?.title ?? 'song'} to position ${at + 1} of ${entries.length}`
  void nextTick(() => rowElement(at)?.focus())
}

function removeRow(index: number): void {
  const p = current.value
  const entry = p?.entries[index]
  if (p === null || entry === undefined) return
  const title = rows.value[index]?.title ?? 'song'
  void change({ entries: p.entries.filter((_, i) => i !== index) })
  selectedRow.value = Math.max(0, Math.min(index, p.entries.length - 2))
  toasts.showUndo(`Removed “${title}”`, () => {
    const now = store.byId.get(p.id)
    if (now === undefined) return
    const entries = [...now.entries]
    entries.splice(index, 0, entry)
    void store.save({ ...now, entries })
  })
}

async function addSong(songId: string): Promise<void> {
  const p = current.value
  if (p === null) return
  const again = inPlaylist.value.has(songId)
  await actions.addSong(p.id, songId, false)
  if (!again) return
  // Songs may repeat: ✓ adds it once more, with Undo (board QGPlaylists).
  toasts.showUndo('Added again', () => {
    const now = store.byId.get(p.id)
    if (now === undefined) return
    void store.save({ ...now, entries: now.entries.slice(0, -1) })
  })
}

// --- Playlists ---------------------------------------------------------------------------

async function createPlaylist(): Promise<void> {
  const p = await actions.create()
  await select(p.id)
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

async function select(id: string): Promise<void> {
  selectedId.value = id
  selectedRow.value = 0
  menuOpen.value = false
  await router.replace({ name: 'playlists', query: { playlist: id } })
}

async function duplicate(): Promise<void> {
  const p = current.value
  if (p === null) return
  menuOpen.value = false
  const copy = await actions.create(
    p.entries.map((e) => e.songId),
    `${p.name} copy`.slice(0, MAX_PLAYLIST_NAME),
  )
  await store.save({
    ...copy,
    entries: p.entries,
    lookId: p.lookId,
    shuffle: p.shuffle,
    repeat: p.repeat,
  })
  await select(copy.id)
}

function startRename(): void {
  menuOpen.value = false
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

async function removePlaylist(): Promise<void> {
  const p = current.value
  if (p === null) return
  menuOpen.value = false
  const index = store.playlists.findIndex((x) => x.id === p.id)
  await store.remove(p.id)
  const next = store.playlists[index] ?? store.playlists[index - 1] ?? null
  selectedId.value = next?.id ?? null
  toasts.showUndo(`Deleted “${p.name}”`, () => {
    void store.save(p, p.updatedAt).then(() => select(p.id))
  })
}

// --- Files -------------------------------------------------------------------------------

function download(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function fileName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'playlist'
  return `${safe}.pmplaylist.json`
}

function exportOne(): void {
  const p = current.value
  if (p === null) return
  download(JSON.stringify(toPlaylistFile([p], settings.looks.saved), null, 2), fileName(p.name))
}

function exportAll(): void {
  menuOpen.value = false
  download(
    JSON.stringify(toPlaylistFile(store.playlists, settings.looks.saved), null, 2),
    'playlists.pmplaylist.json',
  )
}

const IMPORT_ERRORS = {
  notPlaylistFile: "That isn't a PianoMeister playlist file",
  newer: 'That playlist file is from a newer version of PianoMeister',
  empty: 'That playlist file has no playlists in it',
} as const

/** A read file waiting on "Import its looks too" (it carries looks). */
const pending = shallowRef<{ readonly raw: unknown; readonly lookCount: number } | null>(null)
const importLooks = ref(true)
const importOpen = computed({
  get: () => pending.value !== null,
  set: (open: boolean) => {
    if (!open) pending.value = null
  },
})

async function readImport(raw: unknown, withLooks: boolean) {
  return readPlaylistFile(raw, {
    profileId: profiles.activeId,
    playlists: await store.all(),
    songIds: new Set(library.entries.map((e) => e.songId)),
    savedLooks: settings.looks.saved,
    importLooks: withLooks,
    newId: () => crypto.randomUUID(),
  })
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) return
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    toasts.show(IMPORT_ERRORS.notPlaylistFile, 'error')
    return
  }
  const probe = await readImport(raw, true)
  if (!probe.ok) {
    toasts.show(IMPORT_ERRORS[probe.error], 'error')
    return
  }
  if (probe.lookCount > 0) {
    importLooks.value = true
    pending.value = { raw, lookCount: probe.lookCount }
    return
  }
  await finishImport(raw, false)
}

async function finishImport(raw: unknown, withLooks: boolean): Promise<void> {
  pending.value = null
  const result = await readImport(raw, withLooks)
  if (!result.ok) {
    toasts.show(IMPORT_ERRORS[result.error], 'error')
    return
  }
  if (result.looks.length > 0) {
    settings.setLooks({ ...settings.looks, saved: [...settings.looks.saved, ...result.looks] })
  }
  if (result.playlists.length > 0) await store.addAll(result.playlists)
  const n = result.playlists.length
  const missing =
    result.missingSongs > 0
      ? ` · ${result.missingSongs} ${result.missingSongs === 1 ? 'song isn’t' : 'songs aren’t'} in this library`
      : ''
  toasts.show(
    n === 0
      ? 'Those playlists are here already'
      : `Imported ${n} ${n === 1 ? 'playlist' : 'playlists'}${missing}`,
  )
  const first = result.playlists[0]
  if (first !== undefined) await select(first.id)
}

// --- Drag and keys -----------------------------------------------------------------------

const dragFrom = ref<number | null>(null)
const dropAt = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent): void {
  dragFrom.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragOver(index: number, event: DragEvent): void {
  if (dragFrom.value === null) return
  event.preventDefault()
  dropAt.value = index
}
function onDrop(index: number): void {
  const from = dragFrom.value
  dragFrom.value = null
  dropAt.value = null
  if (from !== null) move(from, index)
}
function onDragEnd(): void {
  dragFrom.value = null
  dropAt.value = null
}

function rowElement(index: number): HTMLElement | null {
  return document.querySelectorAll<HTMLElement>('[data-testid="playlist-row"]')[index] ?? null
}

/** Alt+↑/↓ on a focused row move it (the drag's keyboard alternative). */
function onRowKey(index: number, event: KeyboardEvent): void {
  if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
  event.preventDefault()
  event.stopPropagation()
  move(index, index + (event.key === 'ArrowDown' ? 1 : -1))
}

function moveRow(by: number): void {
  const n = rows.value.length
  if (n === 0) return
  const next = Math.min(n - 1, Math.max(0, selectedRow.value + by))
  const hadFocus = document.activeElement?.closest('[data-testid="playlist-row"]') != null
  selectedRow.value = next
  void nextTick(() => {
    const el = rowElement(next)
    el?.scrollIntoView({ block: 'nearest' })
    if (hadFocus) el?.focus()
  })
}

function movePlaylist(by: number): void {
  const list = store.playlists
  const at = list.findIndex((p) => p.id === current.value?.id)
  const next = list[Math.min(list.length - 1, Math.max(0, at + by))]
  if (next !== undefined && next.id !== current.value?.id) void select(next.id)
}

/** List keys by role (brief decisions 90–91): songs are the main list, playlists the side. */
function onPageKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || pending.value !== null) return
  const command = pageListCommand(event, settings.bindings)
  switch (command) {
    case 'listNext':
    case 'listPrevious':
      moveRow(command === 'listNext' ? 1 : -1)
      break
    case 'secondaryNext':
    case 'secondaryPrevious':
      movePlaylist(command === 'secondaryNext' ? 1 : -1)
      break
    case 'listOpen':
      if (current.value === null) return
      void actions.play(current.value.id, selectedRow.value)
      break
    case 'nextTab':
    case 'previousTab':
      void router.push({ name: manageTabStep('playlists', command === 'nextTab' ? 1 : -1) })
      break
    default:
      return
  }
  event.preventDefault()
}

onMounted(() => window.addEventListener('keydown', onPageKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onPageKeyDown))

function readQuery(): void {
  const id = route.query.playlist
  if (typeof id === 'string' && id !== '') selectedId.value = id
  if (route.query.focus === 'name') {
    void nextTick(() => {
      nameInput.value?.focus()
      nameInput.value?.select()
    })
  }
}
watch(() => route.query, readQuery)

const backdrop = computed(() =>
  sceneSnapshot.value === null ? undefined : { backgroundImage: `url(${sceneSnapshot.value})` },
)

onMounted(async () => {
  await Promise.all([library.loaded ? null : library.refresh(), store.refresh()])
  readQuery()
})
</script>

<template>
  <main class="playlists-page">
    <div
      class="backdrop"
      :class="{ snapshot: backdrop !== undefined }"
      :style="backdrop"
      aria-hidden="true"
    />
    <div class="window glass" data-testid="playlists-page">
      <header class="top">
        <RouterLink :to="{ name: 'player' }" class="back" data-testid="back-to-player">
          <AppIcon name="chevronLeft" :size="18" /> Player
        </RouterLink>
        <HomeLink />
        <ManageTabs active="playlists" />
        <span class="spacer" />
        <AppButton variant="primary" data-testid="playlist-new" @click="createPlaylist">
          New playlist
        </AppButton>
        <AppButton data-testid="playlist-import" @click="fileInput?.click()">Import</AppButton>
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="playlist-import-file"
          @change="onFile"
        />
      </header>

      <div
        v-if="store.loaded && store.playlists.length === 0"
        class="empty-all"
        data-testid="playlists-empty"
      >
        <AppIcon name="playlist" :size="32" />
        <p>Make a playlist to listen to songs back to back</p>
        <AppButton variant="primary" @click="createPlaylist">New playlist</AppButton>
      </div>

      <div v-else class="body">
        <aside class="lists" aria-label="Playlists">
          <h2 class="section-caps">Your playlists</h2>
          <button
            v-for="p in store.playlists"
            :key="p.id"
            type="button"
            class="list-item"
            :aria-pressed="current?.id === p.id"
            data-testid="playlist-item"
            @click="select(p.id)"
          >
            <span class="list-name" :title="p.name">{{ p.name }}</span>
            <span class="list-meta">{{ meta(p) }}</span>
            <span class="list-look">
              <span class="dot" :style="{ background: swatch(p.lookId) }" />Look:
              {{ lookName(p.lookId) }}
            </span>
          </button>
          <p class="note">Listening isn’t practice: nothing is logged while a playlist plays.</p>
        </aside>

        <section v-if="current" class="editor" aria-label="Playlist editor">
          <div class="editor-head">
            <div class="name-row">
              <label class="name-field">
                Name
                <input
                  ref="nameInput"
                  :key="current.id"
                  v-model="nameDraft"
                  type="text"
                  :maxlength="MAX_PLAYLIST_NAME"
                  data-testid="playlist-name"
                  @change="rename"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                />
              </label>
              <span class="head-meta" data-testid="playlist-meta">{{ headerMeta }}</span>
            </div>
            <div class="toolbar">
              <AppButton
                variant="primary"
                icon="play"
                :disabled="current.entries.length === 0"
                data-testid="playlist-play"
                @click="actions.play(current.id)"
              >
                Play
              </AppButton>
              <button
                type="button"
                class="toggle"
                :aria-pressed="current.shuffle"
                data-testid="playlist-shuffle"
                @click="change({ shuffle: !current.shuffle })"
              >
                <AppIcon name="shuffle" :size="18" /> Shuffle
              </button>
              <span class="labelled">
                <AppIcon name="repeat" :size="18" /> Repeat
                <SelectField
                  :model-value="current.repeat"
                  :options="REPEAT_OPTIONS"
                  label="Repeat"
                  data-testid="playlist-repeat"
                  @update:model-value="change({ repeat: $event })"
                />
              </span>
              <span class="labelled">
                Look
                <SelectField
                  :model-value="
                    lookOf(current.lookId) === null ? CURRENT : (current.lookId ?? CURRENT)
                  "
                  :options="lookOptions"
                  label="Playlist look"
                  data-testid="playlist-look"
                  @update:model-value="setLook"
                />
              </span>
              <span class="spacer" />
              <AppButton
                aria-label="Export playlist"
                data-testid="playlist-export"
                @click="exportOne"
              >
                Export
              </AppButton>
              <AppPopover
                v-model:open="menuOpen"
                side="bottom"
                align="end"
                label="More playlist actions"
              >
                <template #trigger>
                  <IconButton
                    icon="more"
                    label="More: rename, duplicate, export all, delete"
                    variant="outline"
                    data-testid="playlist-more"
                  />
                </template>
                <div class="menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="playlist-rename"
                    @click="startRename"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="playlist-duplicate"
                    @click="duplicate"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="playlist-export-all"
                    @click="exportAll"
                  >
                    Export all
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="danger"
                    data-testid="playlist-delete"
                    @click="removePlaylist"
                  >
                    Delete
                  </button>
                </div>
              </AppPopover>
            </div>
          </div>

          <div class="cols" aria-hidden="true">
            <span /><span>#</span><span>Song</span><span>Length</span><span>Look</span><span />
          </div>
          <div class="rows" role="list" aria-label="Songs in this playlist">
            <div
              v-for="r in rows"
              :key="`${r.index}-${r.entry.songId}`"
              role="listitem"
              class="row"
              :class="{
                selected: r.index === selectedRow,
                missing: r.missing,
                dragging: dragFrom === r.index,
                'drop-target': dropAt === r.index && dragFrom !== r.index,
              }"
              tabindex="0"
              data-testid="playlist-row"
              @focus="selectedRow = r.index"
              @click="selectedRow = r.index"
              @keydown="onRowKey(r.index, $event)"
              @dragover="onDragOver(r.index, $event)"
              @drop.prevent="onDrop(r.index)"
            >
              <span
                class="handle"
                draggable="true"
                role="img"
                :aria-label="`Drag to reorder ${r.title} (or Alt+↑/↓)`"
                data-testid="playlist-row-drag"
                @dragstart="onDragStart(r.index, $event)"
                @dragend="onDragEnd"
              >
                <AppIcon name="drag" :size="18" />
              </span>
              <span class="n">{{ r.index + 1 }}</span>
              <span class="song">
                <span class="title" :title="r.title" data-testid="playlist-row-title">{{
                  r.title
                }}</span>
                <span class="composer">{{ r.composer }}</span>
              </span>
              <span class="len">{{ r.length }}</span>
              <span class="row-look" :class="{ own: r.look !== PLAYLIST_LOOK }">
                <span class="dot" :style="{ background: r.swatch }" />
                <SelectField
                  :model-value="r.look"
                  :options="rowLookOptions"
                  :label="`Look for ${r.title}`"
                  data-testid="playlist-row-look"
                  @update:model-value="setRowLook(r.index, $event)"
                />
              </span>
              <IconButton
                icon="close"
                size="sm"
                :label="`Remove ${r.title} from playlist`"
                data-testid="playlist-row-remove"
                @click.stop="removeRow(r.index)"
              />
            </div>
            <p v-if="rows.length === 0" class="empty" data-testid="playlist-empty">
              Add songs from the panel on the right
            </p>
            <p v-else class="hint">
              Drag to reorder · per-song looks override the playlist’s look for that song only
            </p>
          </div>
          <p class="sr-only" aria-live="polite" data-testid="playlist-announce">
            {{ announcement }}
          </p>
        </section>

        <aside v-if="current" class="add" aria-label="Add songs">
          <h2 class="section-caps">Add songs</h2>
          <SearchField
            v-model="search"
            label="Search the library"
            placeholder="Search the library"
            data-testid="playlist-add-search"
          />
          <div class="add-list">
            <div
              v-for="s in addable"
              :key="s.songId"
              class="add-row"
              data-testid="playlist-add-song"
            >
              <span class="song">
                <span class="title" :title="s.title">{{ s.title }}</span>
                <span class="composer"
                  >{{ s.composer || 'Unknown composer' }} ·
                  {{ formatTime(s.facts.durationSeconds) }}</span
                >
              </span>
              <button
                type="button"
                class="add-button"
                :class="{ added: inPlaylist.has(s.songId) }"
                :aria-label="
                  inPlaylist.has(s.songId)
                    ? `${s.title} is in the playlist: add it again`
                    : `Add ${s.title}`
                "
                data-testid="playlist-add-button"
                @click="addSong(s.songId)"
              >
                <AppIcon :name="inPlaylist.has(s.songId) ? 'check' : 'plus'" :size="16" />
              </button>
            </div>
          </div>
          <p class="note">Also from the Library and the song picker: “Add to playlist…”</p>
        </aside>
      </div>
    </div>

    <AppDialog
      v-model:open="importOpen"
      title="Import playlists"
      show-title
      width="440px"
      data-testid="playlist-import-dialog"
    >
      <label class="check">
        <input v-model="importLooks" type="checkbox" data-testid="playlist-import-looks" />
        Import its looks too ({{ pending?.lookCount ?? 0 }})
      </label>
      <p class="dialog-text">
        Looks already in My looks are kept as they are. Without them, songs use the playlist’s look
        or the current one.
      </p>
      <template #footer>
        <AppButton
          variant="primary"
          data-testid="playlist-import-confirm"
          @click="pending && finishImport(pending.raw, importLooks)"
        >
          Import
        </AppButton>
        <AppButton @click="pending = null">Cancel</AppButton>
      </template>
    </AppDialog>
  </main>
</template>

<style scoped>
.playlists-page {
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

.spacer {
  flex: 1;
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

.empty-all {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--text-3);
}

.empty-all p {
  margin: 0;
  color: var(--text-2);
  font-size: var(--text-md);
}

.lists {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 6px;
  width: 250px;
  padding: 14px 12px;
  overflow-y: auto;
  border-right: 1px solid var(--divider);
}

.lists .section-caps,
.add .section-caps {
  margin: 0 8px 6px;
}

.list-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.list-item:hover {
  background: rgb(255 255 255 / 5%);
}

.list-item[aria-pressed='true'] {
  background: rgb(var(--primary-rgb) / 16%);
}

.list-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-meta {
  color: var(--text-3);
  font-size: 12px;
}

.list-look {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-4);
  font-size: 12px;
}

.dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 999px;
}

.note {
  margin: auto 0 0;
  padding: 10px 8px 0;
  color: var(--text-4);
  font-size: 12px;
  line-height: 1.5;
}

.editor {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.editor-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--divider);
}

.name-row {
  display: flex;
  align-items: flex-end;
  gap: 14px;
}

.name-field {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  color: var(--text-4);
  font-size: 12px;
}

.name-field input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 10px;
  background: rgb(255 255 255 / 4%);
  color: var(--text-strong);
  font: inherit;
  font-size: 20px;
  font-weight: 500;
}

.name-field input:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-field);
}

.head-meta {
  padding-bottom: 10px;
  color: var(--text-3);
  font-size: 13px;
  white-space: nowrap;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.toggle[aria-pressed='true'] {
  border-color: var(--primary);
  background: rgb(var(--primary-rgb) / 14%);
  color: var(--text-strong);
}

.labelled {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 4px 0 12px;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--radius-md);
  color: var(--text-2);
  font-size: 14px;
}

.labelled :deep(.select-trigger) {
  min-width: 0;
  min-height: 32px;
  height: 32px;
  padding: 0 6px 0 10px;
  border: 0;
  background: rgb(255 255 255 / 6%);
}

.add :deep(.search-field) {
  flex: none;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 160px;
  padding: 6px;
}

.menu button {
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.menu button:hover,
.menu button:focus-visible {
  outline: none;
  background: rgb(var(--primary-rgb) / 18%);
}

.menu .danger {
  color: var(--danger, #ff9d7a);
}

.cols,
.row {
  display: grid;
  grid-template-columns: 28px 26px minmax(0, 1fr) 56px 190px 36px;
  align-items: center;
  gap: 10px;
  padding: 6px 20px;
}

.cols {
  padding-block: 10px;
  border-bottom: 1px solid var(--divider);
  color: var(--text-4);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.rows {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.row {
  border-bottom: 1px solid rgb(255 255 255 / 4%);
}

.row:hover {
  background: rgb(255 255 255 / 3%);
}

.row.selected {
  background: rgb(var(--primary-rgb) / 10%);
}

.row:focus-visible {
  outline: none;
  box-shadow: inset var(--focus-ring-field);
}

.row.dragging {
  opacity: 0.5;
}

.row.drop-target {
  box-shadow: inset 0 2px 0 var(--primary);
}

.row.missing .title {
  color: var(--text-3);
  font-style: italic;
}

.handle {
  display: grid;
  place-items: center;
  height: 36px;
  color: var(--text-4);
  cursor: grab;
}

.n {
  color: var(--text-4);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.song {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer {
  overflow: hidden;
  color: var(--text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.len {
  color: var(--text-2);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.row-look {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.row-look :deep(.select-trigger) {
  flex: 1;
  min-width: 0;
  min-height: 34px;
  height: 34px;
  color: var(--text-4);
  font-size: 13px;
}

.row-look :deep(.select-trigger > span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-look.own :deep(.select-trigger) {
  color: var(--text-strong);
}

.empty,
.hint {
  margin: 12px 20px 16px;
  color: var(--text-4);
  font-size: 12px;
}

.empty {
  padding: var(--space-6) 0;
  color: var(--text-3);
  font-size: var(--text-md);
}

.add {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 10px;
  width: 300px;
  padding: 16px 14px;
  border-left: 1px solid var(--divider);
}

.add-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px 6px 8px;
  border-radius: 10px;
}

.add-button {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 9px;
  background: transparent;
  color: var(--text-1);
  cursor: pointer;
}

.add-button.added {
  border-color: transparent;
  background: rgb(126 224 195 / 14%);
  color: #7ee0c3;
}

.check {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-1);
}

.dialog-text {
  color: var(--text-3);
  font-size: var(--text-sm);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (width < 1100px) {
  .lists {
    width: 210px;
  }

  .add {
    width: 250px;
  }

  .cols,
  .row {
    grid-template-columns: 24px 22px minmax(0, 1fr) 48px 150px 32px;
    gap: 8px;
    padding-inline: 14px;
  }
}
</style>
