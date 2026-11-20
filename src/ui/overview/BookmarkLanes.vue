<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef } from 'vue'

import { barAtTick } from '@/core/overview/barAtTick'
import type { BarLayout } from '@/core/overview/BarLayout'
import { moveRange } from '@/core/overview/moveRange'
import type { OverviewView } from '@/core/overview/OverviewView'
import { resizeRange } from '@/core/overview/resizeRange'
import { stackLanes } from '@/core/overview/stackLanes'
import type { Bookmark } from '@/core/practice/Bookmark'
import { clampRange } from '@/core/practice/clampRange'
import { sameRange } from '@/core/practice/diffFromBookmark'
import type { LoopRange } from '@/core/transport/LoopRange'

import type { RollFrame } from './RollFrame'
import { rollScale } from './rollScale'

/**
 * The song's bookmarks as labelled ranges under the bar numbers (strip, brief decision 105) or
 * under the notes (editor, decision 106), stacked when they overlap. In the strip a click loads
 * one and the one playing is lit; in the editor a click selects one, and the selected one's
 * ends and body drag to change its range (decision 107), applied on release.
 */
const props = defineProps<{
  readonly bookmarks: readonly Bookmark[]
  readonly layout: BarLayout
  readonly view: OverviewView
  readonly width: number
  readonly frame: Pick<RollFrame, 'padLeft' | 'padRight'>
  readonly variant: 'strip' | 'editor'
  /** Lit: the bookmark playing (strip) or the selected one (editor). */
  readonly activeId: string | null
  readonly rowHeight: number
  readonly rowPitch: number
  readonly maxRows?: number
}>()
const emit = defineEmits<{
  pick: [id: string]
  change: [id: string, range: LoopRange]
  more: []
}>()

/** A range being dragged in the editor (shown at once, saved on release). */
const draft = shallowRef<{ readonly id: string; readonly range: LoopRange } | null>(null)

const ranges = computed(() =>
  props.bookmarks.map((b) => {
    const saved = clampRange(b.config.loop, props.layout.firstBar, props.layout.lastBar)
    return {
      bookmark: b,
      range: draft.value?.id === b.id ? draft.value.range : saved,
    }
  }),
)
const stacked = computed(() =>
  stackLanes(
    ranges.value.map((r) => ({ id: r.bookmark.id, ...r.range })),
    props.maxRows,
  ),
)
const scale = computed(() => rollScale(props.view, props.width, props.frame))
const items = computed(() => {
  const s = scale.value
  const rowOf = new Map(stacked.value.rows.map((r) => [r.id, r.row]))
  const out = []
  for (const { bookmark, range } of ranges.value) {
    const row = rowOf.get(bookmark.id)
    if (row === undefined) continue
    const a = props.layout.bars.find((b) => b.bar === range.startBar)
    const z = props.layout.bars.find((b) => b.bar === range.endBar)
    const left = s.x(a?.startTick ?? 0) + 1
    const right = s.x(z?.endTick ?? 0) - 1
    // Out of view (zoomed in): nothing to show.
    if (right < props.frame.padLeft || left > props.width - props.frame.padRight) continue
    out.push({
      bookmark,
      range,
      left,
      width: Math.max(4, right - left),
      // A range that starts left of the view keeps its label in sight.
      inset: Math.min(Math.max(0, props.frame.padLeft - left), Math.max(0, right - left - 24)),
      top: row * props.rowPitch,
      title: `${bookmark.name} · bars ${range.startBar}–${range.endBar}`,
    })
  }
  return out
})
const height = computed(
  () => Math.max(1, stacked.value.rowCount) * props.rowPitch - (props.rowPitch - props.rowHeight),
)

// ---- Keys: one Tab stop, arrows inside (roving tabindex) ------------------------------------

/** The item that last had focus; the lanes' one Tab stop while it's still shown. */
const focusId = ref<string | null>(null)
const tabTarget = computed((): string | null => {
  const shown = items.value
  const has = (id: string | null) => id !== null && shown.some((i) => i.bookmark.id === id)
  if (has(focusId.value)) return focusId.value
  if (has(props.activeId)) return props.activeId
  const first = [...shown].sort((a, b) => a.top - b.top || a.left - b.left)[0]
  return first?.bookmark.id ?? null
})

/**
 * ←/→ the previous or next bookmark in the row, ↑/↓ the nearest one (by its middle) in the
 * row above or below. Handled here, so the player's own arrow keys don't also run.
 */
function onArrow(event: KeyboardEvent, id: string): void {
  const steps: Record<string, readonly [number, number]> = {
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
  }
  const step = steps[event.key]
  const from = items.value.find((i) => i.bookmark.id === id)
  if (step === undefined || from === undefined) return
  event.preventDefault()
  const [rowStep, colStep] = step
  let next: (typeof items.value)[number] | undefined
  if (colStep !== 0) {
    const row = items.value.filter((i) => i.top === from.top).sort((a, b) => a.left - b.left)
    next = row[row.indexOf(from) + colStep]
  } else {
    const middle = from.left + from.width / 2
    next = items.value
      .filter((i) => i.top === from.top + rowStep * props.rowPitch)
      .sort(
        (a, b) =>
          Math.abs(a.left + a.width / 2 - middle) - Math.abs(b.left + b.width / 2 - middle),
      )[0]
  }
  if (next === undefined) return
  focusId.value = next.bookmark.id
  void nextTick(() =>
    root.value
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(next.bookmark.id)}"] .body`)
      ?.focus(),
  )
}

// ---- Editor drags ------------------------------------------------------------------------

let drag: {
  readonly id: string
  readonly part: 'body' | 'start' | 'end'
  readonly base: LoopRange
  readonly x: number
  readonly tick: number
  moved: boolean
} | null = null

const root = useTemplateRef<HTMLElement>('root')

function local(event: PointerEvent): number {
  return event.clientX - (root.value?.getBoundingClientRect().left ?? 0)
}

/** The bar boundary nearest x, as for the loop handles. */
function boundaryBar(x: number, end: 'start' | 'end'): number {
  const tick = scale.value.tick(x)
  const bar = barAtTick(props.layout, tick)
  const span = props.layout.bars.find((b) => b.bar === bar)
  if (span === undefined) return bar
  const past = (tick - span.startTick) / Math.max(1, span.endTick - span.startTick) >= 0.5
  return end === 'start' ? (past ? bar + 1 : bar) : past ? bar : bar - 1
}

function onPointerDown(
  event: PointerEvent,
  id: string,
  range: LoopRange,
  part: 'body' | 'start' | 'end',
): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.stopPropagation()
  if (props.variant === 'strip' || props.activeId !== id) {
    // Not draggable: a click picks it.
    drag = { id, part: 'body', base: range, x: local(event), tick: 0, moved: false }
    return
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const x = local(event)
  drag = { id, part, base: range, x, tick: scale.value.tick(x), moved: false }
}

function onPointerMove(event: PointerEvent): void {
  const d = drag
  if (d === null || props.variant === 'strip' || props.activeId !== d.id) return
  const x = local(event)
  if (!d.moved && Math.abs(x - d.x) < 4) return
  d.moved = true
  const { firstBar, lastBar } = props.layout
  const range =
    d.part === 'body'
      ? moveRange(
          d.base,
          barAtTick(props.layout, scale.value.tick(x)) - barAtTick(props.layout, d.tick),
          firstBar,
          lastBar,
        )
      : resizeRange(d.base, d.part, boundaryBar(x, d.part), firstBar, lastBar)
  draft.value = { id: d.id, range }
}

function onPointerUp(): void {
  const d = drag
  drag = null
  if (d === null) return
  if (!d.moved) {
    draft.value = null
    emit('pick', d.id)
    return
  }
  const next = draft.value
  draft.value = null
  if (next !== null && !sameRange(next.range, d.base)) emit('change', d.id, next.range)
}

function onPointerCancel(): void {
  drag = null
  draft.value = null
}
</script>

<template>
  <div
    ref="root"
    class="lanes"
    :class="`in-${variant}`"
    :style="{
      height: `${height}px`,
      clipPath: `inset(-2px ${frame.padRight}px -2px ${frame.padLeft}px)`,
    }"
    role="list"
    aria-label="Bookmarks (arrow keys move between them)"
    data-testid="lanes"
  >
    <div
      v-for="item in items"
      :key="item.bookmark.id"
      role="listitem"
      class="item"
      :class="{ active: item.bookmark.id === activeId, dragging: draft?.id === item.bookmark.id }"
      :style="{
        left: `${item.left}px`,
        width: `${item.width}px`,
        top: `${item.top}px`,
        height: `${rowHeight}px`,
      }"
      data-testid="lane-item"
      :data-id="item.bookmark.id"
      :data-range="`${item.range.startBar}-${item.range.endBar}`"
    >
      <button
        type="button"
        class="body"
        :title="item.title"
        :aria-label="item.title"
        :aria-pressed="item.bookmark.id === activeId"
        :tabindex="item.bookmark.id === tabTarget ? 0 : -1"
        :style="item.inset > 0 ? { paddingLeft: `${item.inset + 7}px` } : undefined"
        @pointerdown="onPointerDown($event, item.bookmark.id, item.range, 'body')"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @focus="focusId = item.bookmark.id"
        @keydown="onArrow($event, item.bookmark.id)"
        @keydown.enter.prevent="emit('pick', item.bookmark.id)"
        @keydown.space.prevent="emit('pick', item.bookmark.id)"
      >
        {{ item.bookmark.name }}
      </button>
      <template v-if="variant === 'editor' && item.bookmark.id === activeId">
        <span
          class="grip start"
          aria-hidden="true"
          data-testid="lane-grip-start"
          @pointerdown="onPointerDown($event, item.bookmark.id, item.range, 'start')"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
        />
        <span
          class="grip end"
          aria-hidden="true"
          data-testid="lane-grip-end"
          @pointerdown="onPointerDown($event, item.bookmark.id, item.range, 'end')"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
        />
      </template>
    </div>
    <button
      v-if="stacked.hidden > 0"
      type="button"
      class="more"
      :style="{
        top: `${(Math.max(1, stacked.rowCount) - 1) * rowPitch}px`,
        height: `${rowHeight}px`,
      }"
      :title="`${stacked.hidden} more ${stacked.hidden === 1 ? 'bookmark' : 'bookmarks'} · open the editor to see them all`"
      data-testid="lanes-more"
      @click="emit('more')"
    >
      +{{ stacked.hidden }}
    </button>
  </div>
</template>

<style scoped>
/* Sizes and colours from QGOverviewA (strip) and QGOverviewB (editor). */
.lanes {
  position: relative;
  overflow: hidden;
  /* Over the roll: only the items take the pointer. */
  pointer-events: none;
}

.item,
.more {
  pointer-events: auto;
}

.item {
  position: absolute;
  box-sizing: border-box;
  min-width: 4px;
  border: 1px solid rgb(var(--secondary-rgb) / 45%);
  border-radius: 6px;
  background: rgb(255 255 255 / 5%);
  touch-action: none;
}

.in-editor .item {
  border-radius: 7px;
}

.item.active {
  border-color: var(--secondary);
  background: rgb(var(--secondary-rgb) / 28%);
}

.body {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0 7px;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.in-editor .body {
  padding: 0 9px;
  font-size: var(--text-xs);
}

.active .body {
  color: var(--text-1);
}

.in-editor .active .body {
  cursor: grab;
}

.dragging .body {
  cursor: grabbing;
}

.body:focus-visible {
  border-radius: inherit;
  outline: none;
  box-shadow: var(--focus-ring);
}

/* The selected bookmark's ends (editor): white grips that resize it. */
.grip {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 14px;
  margin-top: -7px;
  border-radius: 2px;
  background: #fff;
  cursor: ew-resize;
}

.grip::before {
  position: absolute;
  inset: -6px -6px;
  content: '';
}

.grip.start {
  left: -2px;
}

.grip.end {
  right: -2px;
}

.more {
  position: absolute;
  right: 0;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: rgb(10 14 28 / 85%);
  color: var(--text-3);
  font-size: 11px;
  cursor: pointer;
}
</style>
