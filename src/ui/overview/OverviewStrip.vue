<script setup lang="ts">
import { computed, shallowRef, toRef, useTemplateRef, watch } from 'vue'

import { layoutBars } from '@/core/overview/layoutBars'
import { stackLanes } from '@/core/overview/stackLanes'
import type { Bookmark } from '@/core/practice/Bookmark'
import { clampRange } from '@/core/practice/clampRange'
import type { LoopRange } from '@/core/transport/LoopRange'

import AppIcon from '../components/AppIcon.vue'
import type { LoadedSong } from '../playback/LoadedSong'
import BookmarkLanes from './BookmarkLanes.vue'
import PianoRollCanvas from './PianoRollCanvas.vue'
import type { RollFrame } from './RollFrame'
import { rollScale } from './rollScale'
import SelectionActions from './SelectionActions.vue'
import { useElementSize } from './useElementSize'
import { useOverviewView } from './useOverviewView'

/**
 * The overview strip under the timeline (brief decision 105, QGOverviewA): the whole song as a
 * piano roll with the song's bookmarks above it, the loop band and the playhead. It never edits
 * bookmarks: a lane click loads one. Its header controls fade with the player's; the notes,
 * lane, loop and playhead stay.
 */
const props = defineProps<{
  readonly song: LoadedSong
  readonly title: string
  readonly bookmarks: readonly Bookmark[]
  /** The bookmark playing now (decision 69), lit in the lane. */
  readonly playingId: string | null
  readonly loop: LoopRange | null
  readonly tick: number
  readonly playing: boolean
  readonly controlsHidden: boolean
  readonly saveKey: string
  readonly editorKey: string
  readonly closeKey: string
}>()
const emit = defineEmits<{
  seekBar: [bar: number]
  setLoop: [range: LoopRange]
  loadBookmark: [id: string]
  saveSelection: [range: LoopRange]
  openEditor: []
  close: []
}>()

const layout = computed(() => layoutBars(props.song.barMap))
const overview = useOverviewView(layout, toRef(props, 'tick'), toRef(props, 'playing'))
const selection = shallowRef<LoopRange | null>(null)
const strip = useTemplateRef<HTMLElement>('strip')
const size = useElementSize(strip)

watch(
  () => props.song,
  () => (selection.value = null),
)

/** Lane rows: QGOverviewA's 22 px row, a second one when bookmarks overlap (at most 2). */
const LANE_ROW = 22
const LANE_PITCH = 26
const MAX_ROWS = 2
const twoRows = computed(
  () =>
    stackLanes(
      props.bookmarks.map((b) => ({
        id: b.id,
        ...clampRange(b.config.loop, layout.value.firstBar, layout.value.lastBar),
      })),
    ).rowCount > 1,
)
/** The roll's frame, in the canvas (which starts 30 px down the strip). */
const frame = computed((): RollFrame => ({
  padLeft: 20,
  padRight: 20,
  numbersY: 14,
  notesTop: twoRows.value ? 82 : 56,
  notesBottom: 186,
  gridInset: 6,
  tagY: null,
  detail: false,
  playheadDot: true,
  loopAlpha: 0.1,
}))

const zoomLabel = computed(() =>
  overview.barsShown.value === null ? 'Whole song' : `${overview.barsShown.value} bars`,
)
const hands = { right: true, left: true }

/** The action bar sits under the selection, inside the strip's width. */
const ACTION_BAR_WIDTH = 420
const actionsLeft = computed(() => {
  const s = selection.value
  if (s === null) return 0
  const scale = rollScale(overview.view.value, size.value.width, frame.value)
  const bar = layout.value.bars.find((b) => b.bar === s.startBar)
  const x = scale.x(bar?.startTick ?? 0)
  return Math.max(0, Math.min(x, size.value.width - ACTION_BAR_WIDTH))
})

function loopSelection(range: LoopRange): void {
  selection.value = null
  emit('setLoop', range)
}

function saveSelection(range: LoopRange): void {
  emit('saveSelection', range)
}
</script>

<template>
  <section ref="strip" class="strip" aria-label="Song overview" data-testid="overview-strip">
    <header class="head fades" :class="{ hidden: controlsHidden }">
      <span class="cap">Overview</span>
      <span class="song" :title="`${title} · ${layout.lastBar} bars`">
        {{ title }} · {{ layout.lastBar }} bars
      </span>
      <span class="spacer" />
      <span class="legend" aria-hidden="true">
        <span class="swatch right" />Right hand<span class="swatch left" />Left hand
      </span>
      <label class="zoom">
        <span class="zoom-word">Zoom</span>
        <input
          v-model.number="overview.zoom.value"
          type="range"
          min="0"
          max="1"
          step="0.01"
          aria-label="Zoom"
          :aria-valuetext="zoomLabel"
          data-testid="overview-zoom"
        />
        <span class="zoom-label" data-testid="overview-zoom-label">{{ zoomLabel }}</span>
      </label>
      <button
        v-if="!overview.follow.value && !overview.whole.value"
        type="button"
        class="chip"
        title="Follow the playhead"
        data-testid="overview-follow"
        @click="overview.resumeFollow()"
      >
        Follow
      </button>
      <button
        type="button"
        class="quiet open-editor"
        :title="editorKey === '' ? 'Open the loop editor' : `Open the loop editor (${editorKey})`"
        data-testid="overview-open-editor"
        @click="emit('openEditor')"
      >
        Open editor
      </button>
      <button
        type="button"
        class="quiet"
        :aria-label="closeKey === '' ? 'Close overview' : `Close overview (${closeKey})`"
        :title="closeKey === '' ? 'Close overview' : `Close overview (${closeKey})`"
        data-testid="overview-close"
        @click="emit('close')"
      >
        <AppIcon name="chevronUp" :size="14" />{{ closeKey }}
      </button>
    </header>

    <PianoRollCanvas
      class="roll"
      :notes="song.notes"
      :layout="layout"
      :view="overview.view.value"
      :frame="frame"
      :hands="hands"
      :loop="loop"
      :selection="selection"
      :tick="tick"
      :label="`Overview, bars ${layout.firstBar}–${layout.lastBar}`"
      @view="overview.set($event, true)"
      @seek-bar="emit('seekBar', $event)"
      @loop-change="emit('setLoop', $event)"
      @select="selection = $event"
      @loop-selection="loopSelection"
      @save-selection="saveSelection"
    />

    <BookmarkLanes
      class="lanes"
      :bookmarks="bookmarks"
      :layout="layout"
      :view="overview.view.value"
      :width="size.width"
      :frame="frame"
      variant="strip"
      :active-id="playingId"
      :row-height="LANE_ROW"
      :row-pitch="LANE_PITCH"
      :max-rows="MAX_ROWS"
      @pick="emit('loadBookmark', $event)"
      @more="emit('openEditor')"
    />

    <SelectionActions
      v-if="selection"
      class="actions"
      :style="{ left: `${actionsLeft}px` }"
      :selection="selection"
      :save-key="saveKey"
      @loop="loopSelection(selection)"
      @save="saveSelection(selection)"
      @clear="selection = null"
    />
  </section>
</template>

<style scoped>
/* QGOverviewA: 222 px tall, radius 16, a darker glass than the panels. */
.strip {
  position: relative;
  height: 222px;
  box-sizing: border-box;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 16px;
  background: rgb(10 14 28 / 72%);
  backdrop-filter: blur(18px) saturate(140%);
  container-type: inline-size;
}

.head {
  position: absolute;
  z-index: 2;
  top: 9px;
  right: 16px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  overflow: hidden;
  height: 28px;
  white-space: nowrap;
}

.cap {
  color: var(--text-4);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
}

.song {
  overflow: hidden;
  min-width: 0;
  color: var(--text-3);
  font-size: var(--text-sm);
  text-overflow: ellipsis;
}

.spacer {
  flex: 1;
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  font-size: var(--text-xs);
}

.swatch {
  width: 10px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-1);
}

.swatch.left {
  margin-left: 8px;
  background: rgb(232 236 246 / 45%);
}

.zoom {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  font-size: var(--text-xs);
}

.zoom input {
  width: 110px;
  accent-color: var(--primary);
}

.zoom-label {
  min-width: 64px;
  color: var(--text-2);
}

.quiet,
.chip {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 6%);
  color: var(--text-2);
  font-size: var(--text-xs);
  cursor: pointer;
}

.quiet:hover,
.chip:hover {
  background: rgb(255 255 255 / 10%);
  color: var(--text-1);
}

.chip {
  background: rgb(var(--primary-rgb) / 22%);
  color: var(--text-strong);
}

.quiet:focus-visible,
.chip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.roll {
  position: absolute;
  top: 30px;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: 0 0 16px 16px;
}

.lanes {
  position: absolute;
  top: 52px;
  right: 0;
  left: 0;
}

.actions {
  position: absolute;
  z-index: 3;
  top: calc(100% + 4px);
}

/* Narrow strips (between the HUD columns on small screens): the legend and words go first. */
@container (width < 880px) {
  .legend {
    display: none;
  }
}

@container (width < 600px) {
  .cap,
  .zoom-word {
    display: none;
  }

  .zoom input {
    width: 80px;
  }
}

/* Very narrow (the playfield panel open on a tablet): only what's needed to get out or further. */
@container (width < 460px) {
  .song,
  .zoom {
    display: none;
  }
}

@container (width < 300px) {
  .open-editor {
    display: none;
  }
}

.fades {
  transition: opacity var(--dur-slow) var(--ease-out);
}

.fades.hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
