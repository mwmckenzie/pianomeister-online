<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'

import { commandForEvent } from '@/core/commands/shortcutBindings'
import type { HandNote } from '@/core/hands/HandNote'
import { barAtTick } from '@/core/overview/barAtTick'
import type { BarCursor } from '@/core/overview/BarCursor'
import type { BarLayout } from '@/core/overview/BarLayout'
import { hitTest } from '@/core/overview/hitTest'
import type { HitTarget } from '@/core/overview/HitTarget'
import { isLabelledBar } from '@/core/overview/isLabelledBar'
import { labelStep } from '@/core/overview/labelStep'
import { moveBarCursor } from '@/core/overview/moveBarCursor'
import { notesInView } from '@/core/overview/notesInView'
import type { OverviewView } from '@/core/overview/OverviewView'
import { pitchRange } from '@/core/overview/pitchRange'
import { resizeRange } from '@/core/overview/resizeRange'
import { snapSelection } from '@/core/overview/snapSelection'
import { zoomAround } from '@/core/overview/zoomAround'
import { notePaletteColors } from '@/core/color/notePaletteColors'
import { sameRange } from '@/core/practice/diffFromBookmark'
import type { LoopRange } from '@/core/transport/LoopRange'

import { useSettingsStore } from '../stores/settingsStore'
import { readThemeColors } from './readThemeColors'
import type { RollFrame } from './RollFrame'
import { rollScale } from './rollScale'
import type { ThemeColors } from './ThemeColors'
import { useElementSize } from './useElementSize'

/**
 * The piano roll shared by the overview strip and the loop editor (brief decisions 101–104):
 * two stacked canvases — the notes and grid, redrawn only when the view, size, hands or theme
 * change, and a light layer (loop band and handles, selection, bar cursor, playhead) redrawn
 * as those move. Pointer: drag a loop handle (applied on release), drag across the notes to
 * select whole bars, click to seek; Ctrl/⌘ + wheel or pinch zooms, the wheel pans. Keys while
 * focused: ←/→ bar cursor, Shift extends, Enter loops, Save as bookmark saves, Esc clears.
 */
const props = defineProps<{
  readonly notes: readonly HandNote[]
  readonly layout: BarLayout
  readonly view: OverviewView
  readonly frame: RollFrame
  readonly hands: { readonly right: boolean; readonly left: boolean }
  readonly loop: LoopRange | null
  readonly selection: LoopRange | null
  /** The playhead, in ticks. */
  readonly tick: number
  readonly label: string
}>()
const emit = defineEmits<{
  /** The user zoomed or panned: Follow turns off. */
  view: [view: OverviewView]
  seekBar: [bar: number]
  loopChange: [range: LoopRange]
  select: [range: LoopRange | null]
  loopSelection: [range: LoopRange]
  saveSelection: [range: LoopRange]
  /** The keyboard bar cursor moved (the editor's "Play from bar N" falls back to it). */
  cursor: [bar: number]
}>()

const settings = useSettingsStore()
/** The same note colours as the highway (Note colours, brief decision 122). */
const palette = computed(() => notePaletteColors(settings.settings.notes, settings.noteColourSets))
const box = useTemplateRef<HTMLElement>('box')
const notesCanvas = useTemplateRef<HTMLCanvasElement>('notesCanvas')
const overlayCanvas = useTemplateRef<HTMLCanvasElement>('overlayCanvas')
const size = useElementSize(box)

/** A loop handle being dragged (shown at once, applied on release). */
const draftLoop = shallowRef<LoopRange | null>(null)
/** A selection being dragged. */
const draftSelection = shallowRef<LoopRange | null>(null)
const cursor = shallowRef<BarCursor | null>(null)
const focused = ref(false)

const shownLoop = computed(() => draftLoop.value ?? props.loop)
const shownSelection = computed(() => draftSelection.value ?? props.selection)
const sorted = computed(() => [...props.notes].sort((a, b) => a.startTick - b.startTick))
const longest = computed(() =>
  sorted.value.reduce((most, n) => Math.max(most, n.endTick - n.startTick), 0),
)
const pitches = computed(() => pitchRange(props.notes))
const scale = computed(() => rollScale(props.view, size.value.width, props.frame))

const liveText = computed(() => {
  const s = shownSelection.value
  if (s !== null) {
    const n = s.endBar - s.startBar + 1
    return `Selected bars ${s.startBar}–${s.endBar} · ${n} ${n === 1 ? 'bar' : 'bars'}`
  }
  return focused.value && cursor.value !== null ? `Bar ${cursor.value.bar}` : ''
})

// ---- Drawing ----------------------------------------------------------------------------

const TEXT_3 = '#a7b0c6'
const TEXT_4 = '#8f9ab6'
let colors: ThemeColors | null = null
let frameRequest = 0
let notesDirty = true
let overlayDirty = true

function schedule(notes: boolean): void {
  if (notes) notesDirty = true
  overlayDirty = true
  if (frameRequest !== 0) return
  frameRequest = requestAnimationFrame(() => {
    frameRequest = 0
    if (notesDirty) drawNotes()
    if (overlayDirty) drawOverlay()
  })
}

/** Sizes a canvas for the device pixel ratio and returns its context in CSS px. */
function prepare(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (canvas === null) return null
  const { width, height } = size.value
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(width * dpr))
  const h = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  return ctx
}

/** Draws with a 1 px line exactly on the pixel grid. */
const crisp = (x: number) => Math.round(x) + 0.5

/**
 * Perf runs (npm run test:perf) put an array here before the app loads; each notes redraw then
 * records its duration in ms. Nothing is recorded otherwise.
 */
const drawLog = (window as { pianomeisterOverviewDraws?: number[] }).pianomeisterOverviewDraws

function drawNotes(): void {
  const started = drawLog === undefined ? 0 : performance.now()
  drawNotesLayer()
  if (drawLog !== undefined) drawLog.push(performance.now() - started)
}

function drawNotesLayer(): void {
  notesDirty = false
  const ctx = prepare(notesCanvas.value)
  if (ctx === null || size.value.width === 0) return
  const { frame, view, layout } = props
  const { width } = size.value
  const s = scale.value
  const left = frame.padLeft
  const right = width - frame.padRight
  const startTick = view.startTick
  const endTick = view.startTick + view.span
  const visibleBars = layout.bars.filter((b) => b.endTick > startTick && b.startTick < endTick)
  const pxPerBar = (layout.bars.length > 0 ? view.span / visibleBars.length : 1) * s.pxPerTick
  // Bar lines at least 4 px apart: every bar, else every 2nd, 4th… (the strong ones always).
  const lineStep = labelStep(pxPerBar * 6)
  const gridTop = frame.notesTop + frame.gridInset
  const gridBottom = frame.notesBottom - frame.gridInset

  // C lines and labels (editor).
  const { low, high } = pitches.value
  const rows = high - low + 1
  const rowHeight = (frame.notesBottom - frame.notesTop) / rows
  const yOf = (midi: number) => frame.notesBottom - (midi - low + 1) * rowHeight
  if (frame.detail) {
    ctx.font = `10px ${getComputedStyle(box.value as Element).fontFamily}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let midi = Math.ceil(low / 12) * 12; midi <= high; midi += 12) {
      const y = crisp(yOf(midi) + rowHeight / 2)
      ctx.strokeStyle = 'rgb(255 255 255 / 5%)'
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.stroke()
      ctx.fillStyle = TEXT_4
      ctx.fillText(`C${midi / 12 - 1}`, left - 8, y)
    }
  }

  // Beat lines (editor, with room), bar lines, every 4th bar stronger.
  for (const bar of visibleBars) {
    if (frame.detail && pxPerBar / Math.max(1, bar.beatTicks.length + 1) >= 6) {
      ctx.strokeStyle = 'rgb(255 255 255 / 2.5%)'
      ctx.beginPath()
      for (const beat of bar.beatTicks) {
        const x = crisp(s.x(beat))
        if (x < left || x > right) continue
        ctx.moveTo(x, gridTop)
        ctx.lineTo(x, gridBottom)
      }
      ctx.stroke()
    }
    const x = crisp(s.x(bar.startTick))
    if (x < left - 1 || x > right + 1) continue
    const counted = bar.bar < 1 || isLabelledBar(bar.bar, lineStep)
    if (!bar.strong && !counted) continue
    ctx.strokeStyle = bar.strong ? 'rgb(255 255 255 / 10%)' : 'rgb(255 255 255 / 4%)'
    ctx.beginPath()
    ctx.moveTo(x, gridTop)
    ctx.lineTo(x, gridBottom)
    ctx.stroke()
  }

  // Bar numbers.
  const step = labelStep(pxPerBar)
  ctx.font = `10px ${getComputedStyle(box.value as Element).fontFamily}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (const bar of visibleBars) {
    if (!isLabelledBar(bar.bar, step)) continue
    const x = s.x(bar.startTick) + (frame.detail ? 3 : 2)
    if (x < left - 1 || x > right - 8) continue
    ctx.fillStyle = frame.detail && bar.strong ? TEXT_3 : TEXT_4
    ctx.fillText(String(bar.bar), x, frame.numbersY)
  }

  // Notes: pitch-class colours, the left hand at half strength (decision 101).
  ctx.save()
  ctx.beginPath()
  ctx.rect(left, frame.notesTop, right - left, frame.notesBottom - frame.notesTop)
  ctx.clip()
  const noteHeight = rowHeight >= 4 ? rowHeight * 0.9 : Math.max(1.5, rowHeight * 0.7)
  const radius = frame.detail ? 1.5 : 1.2
  const range = notesInView(sorted.value, longest.value, startTick, endTick)
  let lastStyle = ''
  for (let i = range.from; i < range.to; i++) {
    const note = sorted.value[i]
    if (note === undefined || note.endTick <= startTick) continue
    if (note.hand === 'right' ? !props.hands.right : !props.hands.left) continue
    const style = palette.value[note.midi % 12] ?? '#FFFFFF'
    if (style !== lastStyle) {
      ctx.fillStyle = style
      lastStyle = style
    }
    ctx.globalAlpha = note.hand === 'left' ? 0.5 : 1
    const x = s.x(note.startTick)
    const w = Math.max(1.5, (note.endTick - note.startTick) * s.pxPerTick - 1)
    const y = yOf(note.midi) + (rowHeight - noteHeight) / 2
    if (w > 4 && noteHeight > 2.5) {
      ctx.beginPath()
      ctx.roundRect(x, y, w, noteHeight, radius)
      ctx.fill()
    } else ctx.fillRect(x, y, w, noteHeight)
  }
  ctx.restore()
}

function drawOverlay(): void {
  overlayDirty = false
  const ctx = prepare(overlayCanvas.value)
  if (ctx === null || size.value.width === 0 || box.value === null) return
  colors ??= readThemeColors(box.value)
  const { frame, layout } = props
  const { width } = size.value
  const s = scale.value
  const left = frame.padLeft
  const right = width - frame.padRight
  const top = frame.notesTop
  const bottom = frame.notesBottom
  const clampX = (x: number) => Math.min(right, Math.max(left, x))
  const barSpan = (range: LoopRange) => {
    const a = layout.bars.find((b) => b.bar === range.startBar)
    const b = layout.bars.find((b) => b.bar === range.endBar)
    return { x0: s.x(a?.startTick ?? 0), x1: s.x(b?.endTick ?? 0) }
  }

  const loop = shownLoop.value
  if (loop !== null) {
    const { x0, x1 } = barSpan(loop)
    ctx.fillStyle = `rgb(${colors.secondary} / ${frame.loopAlpha})`
    ctx.fillRect(clampX(x0), top, clampX(x1) - clampX(x0), bottom - top)
    ctx.fillStyle = `rgb(${colors.secondary})`
    const handleTop = frame.detail ? top - 2 : top
    const handleHeight = bottom - top + (frame.detail ? 4 : 0)
    for (const x of [x0, x1]) {
      if (x < left - 3 || x > right + 3) continue
      ctx.beginPath()
      ctx.roundRect(x - 3, handleTop, 6, handleHeight, 3)
      ctx.fill()
    }
    // Bar tags: always in the editor, while dragging in the strip.
    const tagY = frame.tagY ?? (draftLoop.value !== null ? frame.numbersY - 12 : null)
    if (tagY !== null) {
      ctx.font = `600 11px ${getComputedStyle(box.value).fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const [x, bar] of [
        [x0, loop.startBar],
        [x1, loop.endBar],
      ] as const) {
        if (x < left - 16 || x > right + 16) continue
        ctx.fillStyle = `rgb(${colors.secondary})`
        ctx.beginPath()
        ctx.roundRect(x - 16, tagY, 32, 18, 6)
        ctx.fill()
        ctx.fillStyle = colors.onSecondary
        ctx.fillText(String(bar), x, tagY + 9.5)
      }
    }
  }

  const selection = shownSelection.value
  if (selection !== null) {
    const { x0, x1 } = barSpan(selection)
    const a = clampX(x0)
    const b = clampX(x1)
    ctx.fillStyle = `rgb(${colors.primary} / 14%)`
    ctx.fillRect(a, top, b - a, bottom - top)
    ctx.strokeStyle = `rgb(${colors.primary} / 70%)`
    ctx.setLineDash([4, 3])
    ctx.strokeRect(crisp(a), crisp(top), Math.round(b - a) - 1, Math.round(bottom - top) - 1)
    ctx.setLineDash([])
  } else if (focused.value && cursor.value !== null) {
    const { x0, x1 } = barSpan({ startBar: cursor.value.bar, endBar: cursor.value.bar })
    ctx.strokeStyle = `rgb(${colors.primary} / 70%)`
    ctx.strokeRect(
      crisp(clampX(x0)),
      crisp(top),
      Math.round(clampX(x1) - clampX(x0)) - 1,
      bottom - top - 1,
    )
  }

  // The playhead (decision 104): white, as on the timeline.
  const x = s.x(props.tick)
  if (x >= left - 1 && x <= right + 1) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(x - 1, top - 4, 2, bottom - top + 6)
    if (frame.playheadDot) {
      ctx.beginPath()
      ctx.arc(x, top - 4, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

watch(
  () => [
    props.view,
    size.value,
    sorted.value,
    props.hands.right,
    props.hands.left,
    props.frame,
    palette.value,
  ],
  () => schedule(true),
)
watch(
  () => [shownLoop.value, shownSelection.value, props.tick, cursor.value, focused.value],
  () => schedule(false),
)
watch(size, () => schedule(true), { immediate: true })
// Appearance → Colours: the theme's custom properties change after this tick.
watch(
  () => [settings.settings.appearance.primary, settings.settings.appearance.secondary],
  () =>
    void nextTick(() => {
      colors = null
      schedule(true)
    }),
)
onBeforeUnmount(() => cancelAnimationFrame(frameRequest))

// ---- Pointer ----------------------------------------------------------------------------

type Gesture =
  | { readonly kind: 'handle'; readonly end: 'start' | 'end'; readonly base: LoopRange }
  | { readonly kind: 'press'; readonly x: number; readonly tick: number; moved: boolean }
  | {
      readonly kind: 'pinch'
      readonly distance: number
      readonly anchor: number
      readonly view: OverviewView
    }

let gesture: Gesture | null = null
const pointers = new Map<number, { x: number; y: number }>()
/** Movement before a press becomes a selection drag, in px. */
const DRAG_PX = 4

function local(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const rect = box.value?.getBoundingClientRect()
  return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
}

/** The bar boundary nearest x: a handle snaps to bar starts (start) or bar ends (end). */
function boundaryBar(x: number, end: 'start' | 'end'): number {
  const tick = scale.value.tick(x)
  const bar = barAtTick(props.layout, tick)
  const span = props.layout.bars.find((b) => b.bar === bar)
  if (span === undefined) return bar
  const past = (tick - span.startTick) / Math.max(1, span.endTick - span.startTick) >= 0.5
  return end === 'start' ? (past ? bar + 1 : bar) : past ? bar : bar - 1
}

function handleTargets(): HitTarget[] {
  const loop = props.loop
  if (loop === null) return []
  const s = scale.value
  const a = props.layout.bars.find((b) => b.bar === loop.startBar)
  const b = props.layout.bars.find((b) => b.bar === loop.endBar)
  const y = props.frame.notesTop
  const height = props.frame.notesBottom - y
  return [
    { kind: 'loopStart', x: s.x(a?.startTick ?? 0) - 3, y, width: 6, height },
    { kind: 'loopEnd', x: s.x(b?.endTick ?? 0) - 3, y, width: 6, height },
  ]
}

function onPointerDown(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const p = local(event)
  pointers.set(event.pointerId, p)
  box.value?.setPointerCapture(event.pointerId)
  if (pointers.size === 2) {
    // A second finger: pinch zoom instead of whatever the first one started.
    const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
    draftLoop.value = null
    draftSelection.value = null
    gesture = {
      kind: 'pinch',
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      anchor: scale.value.tick((a.x + b.x) / 2),
      view: props.view,
    }
    return
  }
  const hit = hitTest(handleTargets(), p.x, p.y)
  if (hit !== null && props.loop !== null) {
    gesture = { kind: 'handle', end: hit.kind === 'loopStart' ? 'start' : 'end', base: props.loop }
    event.preventDefault()
    return
  }
  if (p.y < props.frame.notesTop - 6 || p.y > props.frame.notesBottom + 2) return
  gesture = { kind: 'press', x: p.x, tick: scale.value.tick(p.x), moved: false }
}

function onPointerMove(event: PointerEvent): void {
  if (!pointers.has(event.pointerId)) return
  const p = local(event)
  pointers.set(event.pointerId, p)
  const g = gesture
  if (g === null) return
  const { firstBar, lastBar } = props.layout
  if (g.kind === 'pinch') {
    const [a, b] = [...pointers.values()]
    if (a === undefined || b === undefined) return
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
    emit('view', zoomAround(g.view, g.distance / distance, g.anchor, props.layout))
  } else if (g.kind === 'handle') {
    draftLoop.value = resizeRange(g.base, g.end, boundaryBar(p.x, g.end), firstBar, lastBar)
  } else {
    if (!g.moved && Math.abs(p.x - g.x) < DRAG_PX) return
    g.moved = true
    draftSelection.value = snapSelection(props.layout, g.tick, scale.value.tick(p.x))
  }
}

function onPointerUp(event: PointerEvent): void {
  if (!pointers.delete(event.pointerId)) return
  const g = gesture
  if (g?.kind === 'pinch') {
    if (pointers.size === 0) gesture = null
    return
  }
  gesture = null
  if (g === null) return
  if (g.kind === 'handle') {
    const next = draftLoop.value
    draftLoop.value = null
    if (next !== null && !sameRange(next, props.loop)) emit('loopChange', next)
  } else if (g.moved) {
    const next = draftSelection.value
    draftSelection.value = null
    if (next !== null) {
      cursor.value = { bar: next.endBar, anchor: next.startBar }
      emit('select', next)
    }
  } else {
    if (props.selection !== null) emit('select', null)
    emit('seekBar', barAtTick(props.layout, scale.value.tick(local(event).x)))
  }
}

function onPointerCancel(event: PointerEvent): void {
  pointers.delete(event.pointerId)
  gesture = null
  draftLoop.value = null
  draftSelection.value = null
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const s = scale.value
  if (event.ctrlKey || event.metaKey) {
    const factor = Math.exp(Math.max(-60, Math.min(60, event.deltaY)) * 0.004)
    emit('view', zoomAround(props.view, factor, s.tick(local(event).x), props.layout))
    return
  }
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (delta === 0) return
  emit('view', { startTick: props.view.startTick + delta / s.pxPerTick, span: props.view.span })
}

// ---- Keys -------------------------------------------------------------------------------

function onKeyDown(event: KeyboardEvent): void {
  const { firstBar, lastBar } = props.layout
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    const from = cursor.value ?? {
      bar: Math.min(lastBar, Math.max(firstBar, barAtTick(props.layout, props.tick))),
      anchor: null,
    }
    // Without a cursor yet, the first press puts it at the playhead's bar.
    if (cursor.value === null && !event.shiftKey) {
      cursor.value = from
      return
    }
    const next = moveBarCursor(
      from,
      event.key === 'ArrowLeft' ? -1 : 1,
      event.shiftKey,
      firstBar,
      lastBar,
    )
    cursor.value = next.cursor
    if (next.selection !== null || props.selection !== null) emit('select', next.selection)
    return
  }
  const selection = props.selection
  if (event.key === 'Enter') {
    const bar = cursor.value?.bar
    const range = selection ?? (bar === undefined ? null : { startBar: bar, endBar: bar })
    if (range === null) return
    event.preventDefault()
    emit('loopSelection', range)
    return
  }
  if (event.key === 'Escape' && selection !== null) {
    event.preventDefault()
    if (cursor.value !== null) cursor.value = { bar: cursor.value.bar, anchor: null }
    emit('select', null)
    return
  }
  // Save as bookmark (its key, B by default) saves the selection while the roll has focus.
  if (
    selection !== null &&
    commandForEvent(settings.bindings, 'player', event) === 'saveBookmark'
  ) {
    event.preventDefault()
    emit('saveSelection', selection)
  }
}

watch(cursor, (c) => {
  if (c !== null) emit('cursor', c.bar)
})

/** Esc or × elsewhere cleared the selection: the cursor stops extending it. */
watch(
  () => props.selection,
  (selection) => {
    if (selection === null && cursor.value?.anchor != null) {
      cursor.value = { bar: cursor.value.bar, anchor: null }
    }
  },
)
</script>

<template>
  <div
    ref="box"
    class="roll"
    tabindex="0"
    role="group"
    :aria-label="label"
    aria-roledescription="piano roll"
    data-testid="roll"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @wheel="onWheel"
    @keydown="onKeyDown"
    @focus="focused = true"
    @blur="focused = false"
  >
    <canvas ref="notesCanvas" class="layer" aria-hidden="true" />
    <canvas ref="overlayCanvas" class="layer" aria-hidden="true" data-testid="roll-overlay" />
    <span class="visually-hidden" aria-live="polite" data-testid="roll-live">{{ liveText }}</span>
  </div>
</template>

<style scoped>
.roll {
  position: relative;
  overflow: hidden;
  outline: none;
  touch-action: none;
  user-select: none;
}

.roll:focus-visible {
  box-shadow: inset var(--focus-ring);
}

.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
