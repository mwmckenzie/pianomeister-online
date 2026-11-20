<script setup lang="ts">
import { computed, inject, onMounted, ref, shallowRef, toRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { layoutBars } from '@/core/overview/layoutBars'
import { playFromBar } from '@/core/overview/playFromBar'
import { resizeRange } from '@/core/overview/resizeRange'
import type { Bookmark } from '@/core/practice/Bookmark'
import { bookmarkSummary } from '@/core/practice/bookmarkSummary'
import { clampRange } from '@/core/practice/clampRange'
import { formatLastPracticed } from '@/core/stats/formatLastPracticed'
import { formatPlayedTimes } from '@/core/stats/formatPlays'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'
import type { LoopRange } from '@/core/transport/LoopRange'

import AppIcon from '../components/AppIcon.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import StatsTriple from '../components/StatsTriple.vue'
import BookmarkLanes from '../overview/BookmarkLanes.vue'
import OverviewMinimap from '../overview/OverviewMinimap.vue'
import { overviewHostKey } from '../overview/overviewHostKey'
import PianoRollCanvas from '../overview/PianoRollCanvas.vue'
import type { RollFrame } from '../overview/RollFrame'
import { useElementSize } from '../overview/useElementSize'
import { useOverviewView } from '../overview/useOverviewView'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { usePracticeStore } from '../stores/practiceStore'
import { useUiStateStore } from '../stores/uiStateStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useStatsStore } from '../stores/statsStore'
import { useToastStore } from '../stores/toastStore'

/**
 * The loop editor (`#/editor`, brief decisions 106–107, QGOverviewB): the loaded song as a
 * piano roll over the player, which keeps playing underneath (its scene frozen). The second
 * bookmark editor beside the manager: the selected bookmark's ends and body drag, and its
 * From/To fields edit its range — saved on release, with Undo.
 */
const host = inject(overviewHostKey)
if (host === undefined) throw new Error('The loop editor is a child route of the player')

const route = useRoute()
const router = useRouter()
const bookmarks = useBookmarkStore()
const practice = usePracticeStore()
const settings = useSettingsStore()
const stats = useStatsStore()
const toasts = useToastStore()
const ui = useUiStateStore()

const layout = computed(() => {
  const song = host.song.value
  return song === null ? null : layoutBars(song.barMap)
})
const overview = useOverviewView(layout, host.tick, host.playing)
/** View only, remembered with the UI state (pianomeister.ui). */
const hands = toRef(ui, 'editorHands')
const selection = shallowRef<LoopRange | null>(null)
const cursorBar = ref<number | null>(null)
const selectedId = ref<string | null>(
  typeof route.query.bookmark === 'string' ? route.query.bookmark : null,
)
watch(
  () => route.query.bookmark,
  (id) => {
    if (typeof id === 'string') selectedId.value = id
  },
)

const songBookmarks = computed(() => {
  const id = host.songId.value
  return id === null ? [] : bookmarks.forSong(id)
})
const selected = computed((): Bookmark | null => {
  const b = selectedId.value === null ? undefined : bookmarks.byId.get(selectedId.value)
  return b !== undefined && b.songId === host.songId.value ? b : null
})
const firstBar = computed(() => layout.value?.firstBar ?? 1)
const lastBar = computed(() => layout.value?.lastBar ?? 1)
const selectedRange = computed(() =>
  selected.value === null
    ? null
    : clampRange(selected.value.config.loop, firstBar.value, lastBar.value),
)

// ---- Layout (QGOverviewB at 1280 × 720; the notes area takes what's left) -------------------

const work = useTemplateRef<HTMLElement>('work')
const workSize = useElementSize(work)
const rollBox = useTemplateRef<HTMLElement>('rollBox')
const rollSize = useElementSize(rollBox)
const frame = computed((): RollFrame => ({
  padLeft: 44,
  padRight: 16,
  numbersY: 30,
  notesTop: 38,
  notesBottom: Math.max(80, rollSize.value.height - 2),
  gridInset: 0,
  tagY: 8,
  detail: true,
  playheadDot: false,
  loopAlpha: 0.08,
}))

// ---- Header -----------------------------------------------------------------------------

const PRESETS = [
  { value: 'whole', label: 'Whole song' },
  { value: '32', label: '32 bars' },
  { value: '16', label: '16 bars' },
  { value: '8', label: '8 bars' },
] as const
type Preset = (typeof PRESETS)[number]['value'] | ''
const preset = computed({
  get: (): Preset => {
    const shown = overview.barsShown.value
    if (shown === null) return 'whole'
    const match = PRESETS.find((p) => p.value === String(shown))
    return match?.value ?? ''
  },
  set: (value: Preset) => {
    if (value === '') return
    overview.showBars(value === 'whole' ? null : Number(value))
  },
})

const startBar = computed(() =>
  playFromBar(selection.value, host.loop.value, cursorBar.value ?? firstBar.value),
)

// ---- Bookmark edits (decision 107) --------------------------------------------------------

/** The bookmark the last range edit made this one equal to, by name. */
const sameAs = ref<string | null>(null)
watch(selectedId, () => (sameAs.value = null))

async function changeRange(id: string, range: LoopRange): Promise<void> {
  const before = bookmarks.byId.get(id)
  if (before === undefined) return
  const config = { ...before.config, loop: range }
  await bookmarks.update(id, { config })
  practice.savedLoopChanged(id)
  sameAs.value = bookmarks.findSame({ songId: before.songId, config }, id)?.name ?? null
  toasts.showUndo(
    `Bars of “${before.name}” changed to ${range.startBar}–${range.endBar}`,
    () =>
      void bookmarks.restore(before).then(() => {
        practice.savedLoopChanged(id)
        sameAs.value = null
      }),
  )
}

function commitField(end: 'start' | 'end', event: Event): void {
  const b = selected.value
  const range = selectedRange.value
  const input = event.target as HTMLInputElement
  if (b === null || range === null) return
  const value = Number.parseInt(input.value, 10)
  if (!Number.isFinite(value)) {
    input.value = String(end === 'start' ? range.startBar : range.endBar)
    return
  }
  const next = resizeRange(range, end, value, firstBar.value, lastBar.value)
  input.value = String(end === 'start' ? next.startBar : next.endBar)
  if (next.startBar !== range.startBar || next.endBar !== range.endBar) {
    void changeRange(b.id, next)
  }
}

const statItems = computed(() => {
  const b = selected.value
  if (b === null) return []
  const totals = stats.entry(b.id)
  return [
    { label: 'Played', value: formatPlayedTimes(totals.plays), testid: 'editor-played' },
    { label: 'Practice', value: formatPracticeTime(totals.playedMs), testid: 'editor-practice' },
    {
      label: 'Last',
      value: formatLastPracticed(totals.lastPlayedAt, stats.now),
      testid: 'editor-last',
    },
  ]
})

function pickLane(id: string): void {
  selectedId.value = id
  selection.value = null
}

function onSelect(range: LoopRange | null): void {
  selection.value = range
  if (range !== null) selectedId.value = null
}

function loopRange(range: LoopRange): void {
  selection.value = null
  host?.setLoop(range)
}

function loadInPlayer(): void {
  const b = selected.value
  if (b === null || host === undefined) return
  host.loadBookmark(b.id)
  host.backToPlayer()
}

/** With no bookmark selected, the panel's actions work on the selection, else the loop. */
const actionRange = computed(() => selection.value ?? host.loop.value)
const rangeText = (range: LoopRange) => {
  const n = range.endBar - range.startBar + 1
  return `Bars ${range.startBar}–${range.endBar} · ${n} ${n === 1 ? 'bar' : 'bars'}`
}

const roll = useTemplateRef<InstanceType<typeof PianoRollCanvas>>('roll')
onMounted(() => {
  void bookmarks.refresh()
  void stats.refresh()
  // The roll has the keys on arrival: arrows move the bar cursor, Space plays (the player's).
  ;(roll.value?.$el as HTMLElement | undefined)?.focus()
})
</script>

<template>
  <div class="editor" data-testid="loop-editor">
    <header class="head">
      <button type="button" class="back" data-testid="editor-back" @click="host.backToPlayer()">
        ‹ Player
      </button>
      <h1 class="title">{{ host.title.value }} <span class="dim">· Overview</span></h1>
      <SegmentedControl
        v-model="preset"
        :options="PRESETS"
        label="Zoom"
        data-testid="editor-zoom"
      />
      <div class="hands" role="group" aria-label="Show hands">
        <label
          ><input v-model="hands.right" type="checkbox" data-testid="editor-right" />Right
          hand</label
        >
        <label
          ><input v-model="hands.left" type="checkbox" data-testid="editor-left" />Left hand</label
        >
      </div>
      <button
        v-if="!overview.follow.value && !overview.whole.value"
        type="button"
        class="chip"
        data-testid="editor-follow"
        @click="overview.resumeFollow()"
      >
        Follow
      </button>
      <span class="spacer" />
      <button
        type="button"
        class="outline"
        :title="`Play from bar ${startBar}`"
        data-testid="editor-play-from"
        @click="host.playFrom(startBar)"
      >
        Play from bar {{ startBar }}
      </button>
    </header>

    <div v-if="layout && host.song.value" ref="work" class="work">
      <div ref="rollBox" class="roll-box">
        <PianoRollCanvas
          ref="roll"
          class="roll"
          :notes="host.song.value.notes"
          :layout="layout"
          :view="overview.view.value"
          :frame="frame"
          :hands="hands"
          :loop="host.loop.value"
          :selection="selection"
          :tick="host.tick.value"
          :label="`Piano roll, bars ${layout.firstBar}–${layout.lastBar}`"
          @view="overview.set($event, true)"
          @seek-bar="host.seekBar($event)"
          @loop-change="host.setLoop($event)"
          @select="onSelect"
          @loop-selection="loopRange"
          @save-selection="host.saveSelection($event)"
          @cursor="cursorBar = $event"
        />
      </div>
      <div class="lanes-box">
        <p class="cap">Bookmarks</p>
        <div class="lanes-scroll">
          <BookmarkLanes
            :bookmarks="songBookmarks"
            :layout="layout"
            :view="overview.view.value"
            :width="workSize.width"
            :frame="frame"
            variant="editor"
            :active-id="selected?.id ?? null"
            :row-height="24"
            :row-pitch="30"
            @pick="pickLane"
            @change="changeRange"
          />
          <p v-if="songBookmarks.length === 0" class="empty">
            No bookmarks for this song yet. Drag across the notes, then Save as bookmark.
          </p>
        </div>
      </div>
      <OverviewMinimap
        :notes="host.song.value.notes"
        :layout="layout"
        :view="overview.view.value"
        :frame="frame"
        :hands="hands"
        :loop="host.loop.value"
        @view="overview.set($event, true)"
      />
    </div>

    <aside class="panel" data-testid="editor-panel">
      <template v-if="selected && selectedRange">
        <div class="panel-title">
          <AppIcon name="bookmark" :size="14" class="mark" />
          <h2 data-testid="editor-name">{{ selected.name }}</h2>
        </div>
        <p class="summary" data-testid="editor-summary">
          {{ bookmarkSummary(selected.config, lastBar, { alwaysHands: true }) }}
        </p>
        <div class="fields">
          <label
            >From bar<input
              :value="selectedRange.startBar"
              type="number"
              :min="firstBar"
              :max="lastBar"
              inputmode="numeric"
              data-testid="editor-from"
              @change="commitField('start', $event)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
          /></label>
          <label
            >To bar<input
              :value="selectedRange.endBar"
              type="number"
              :min="firstBar"
              :max="lastBar"
              inputmode="numeric"
              data-testid="editor-to"
              @change="commitField('end', $event)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
          /></label>
        </div>
        <p v-if="sameAs" class="same" data-testid="editor-same">Same settings as “{{ sameAs }}”</p>
        <p class="help">
          Drag the bookmark’s ends in the lane, or the loop handles above the notes. Drag across the
          notes to select new bars.
        </p>
        <StatsTriple :items="statItems" class="stats" />
        <div class="actions">
          <button type="button" class="primary" data-testid="editor-load" @click="loadInPlayer">
            Load in player
          </button>
          <button
            type="button"
            class="outline"
            data-testid="editor-manager"
            @click="router.push({ name: 'bookmarks', query: { bookmark: selected.id } })"
          >
            Edit in bookmark manager
          </button>
        </div>
      </template>
      <template v-else>
        <div class="panel-title">
          <h2 data-testid="editor-name">
            {{ selection ? 'Selection' : host.loop.value ? 'Loop' : 'Nothing selected' }}
          </h2>
        </div>
        <p v-if="actionRange" class="summary" data-testid="editor-summary">
          {{ rangeText(actionRange) }}
        </p>
        <p class="help">
          Drag across the notes to select bars, or pick a bookmark below the notes to edit its
          range.
        </p>
        <div v-if="actionRange" class="actions">
          <button
            v-if="selection"
            type="button"
            class="primary"
            data-testid="editor-loop"
            @click="loopRange(selection)"
          >
            Loop these bars
          </button>
          <button
            type="button"
            :class="selection ? 'outline' : 'primary'"
            :title="`Save as bookmark (${settings.shortcutLabel('saveBookmark')})`"
            data-testid="editor-save"
            @click="host.saveSelection(actionRange)"
          >
            Save as bookmark
          </button>
        </div>
      </template>
    </aside>
  </div>
</template>

<style scoped>
/* QGOverviewB at 1280 × 720: the scene blurred (the player's) under an 80% dim. */
.editor {
  position: absolute;
  z-index: 5;
  inset: 0;
  background: rgb(5 7 15 / 80%);
  color: var(--text-1);
}

.head {
  position: absolute;
  top: 16px;
  right: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.back {
  height: 38px;
  padding: 0 14px 0 10px;
  border: 0;
  border-radius: 12px;
  background: rgb(255 255 255 / 6%);
  color: var(--text-1);
  font-size: var(--text-md);
  cursor: pointer;
}

.back:hover {
  background: rgb(255 255 255 / 10%);
}

.title {
  overflow: hidden;
  min-width: 0;
  margin: 0 8px 0 4px;
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
}

.title .dim {
  color: var(--text-3);
  font-weight: var(--weight-regular);
}

.hands {
  display: flex;
  gap: 14px;
  color: var(--text-2);
  font-size: var(--text-sm);
}

.hands label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.hands input {
  accent-color: var(--primary);
}

.spacer {
  flex: 1;
}

.chip {
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: rgb(var(--primary-rgb) / 22%);
  color: var(--text-strong);
  font-size: var(--text-xs);
  cursor: pointer;
}

.outline,
.primary {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: var(--text-sm);
  cursor: pointer;
}

.outline {
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-1);
}

.outline:hover {
  background: var(--field-hover);
}

.primary {
  border: 0;
  background: var(--primary);
  color: var(--on-primary);
  font-weight: var(--weight-semibold);
}

button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* The roll, lanes and minimap share x: 16 px from the left to 30 px before the panel. */
.work {
  position: absolute;
  top: 72px;
  right: calc(16px + 290px + 30px);
  bottom: 74px;
  left: 16px;
  display: grid;
  grid-template-rows: minmax(120px, 1fr) 190px 46px;
}

.roll-box {
  position: relative;
  min-height: 0;
}

.roll {
  position: absolute;
  inset: 0;
}

.lanes-box {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cap {
  margin: 10px 0 0 44px;
  color: var(--text-4);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-caps);
  line-height: 20px;
  text-transform: uppercase;
}

.lanes-scroll {
  overflow-y: auto;
  min-height: 0;
  padding-top: 0;
  margin-top: 0;
}

.empty {
  margin: 4px 0 0 44px;
  color: var(--text-4);
  font-size: var(--text-sm);
}

/* The side panel (QGOverviewB): glass, 290 px, radius 16, padding 18, gap 14. */
.panel {
  position: absolute;
  top: 72px;
  right: 16px;
  bottom: 16px;
  display: flex;
  width: 290px;
  box-sizing: border-box;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 16px;
  background: rgb(18 24 44 / 55%);
  backdrop-filter: blur(22px) saturate(140%);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title h2 {
  overflow: hidden;
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mark {
  flex-shrink: 0;
  color: var(--secondary);
}

.summary {
  margin: 0;
  color: var(--text-3);
  font-size: var(--text-sm);
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--text-3);
  font-size: var(--text-xs);
}

.fields input {
  height: 34px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid var(--border-field);
  border-radius: 9px;
  background: rgb(255 255 255 / 5%);
  color: var(--text-strong);
  font: inherit;
  font-size: var(--text-md);
}

.fields input:focus {
  outline: none;
  box-shadow: var(--focus-ring-field);
}

.same {
  margin: 0;
  color: var(--secondary);
  font-size: var(--text-xs);
}

.help {
  margin: 0;
  color: var(--text-4);
  font-size: var(--text-xs);
  line-height: 1.5;
}

/* The panel is narrow: the columns fit their values ("1 h 13 min") instead of a third each. */
.stats :deep(.stats-triple) {
  grid-template-columns: auto auto auto;
  justify-content: space-between;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.actions .primary,
.actions .outline {
  height: 40px;
  border-radius: 11px;
  font-size: var(--text-md);
}
</style>
