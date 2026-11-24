<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

import { noteAt, type NoteBox } from '@/core/hands/noteAt'
import { noteName } from '@/core/noteName'
import type { BarLayout } from '@/core/overview/BarLayout'
import { clampView } from '@/core/overview/clampView'
import { isLabelledBar } from '@/core/overview/isLabelledBar'
import { labelStep } from '@/core/overview/labelStep'
import { notesInView } from '@/core/overview/notesInView'
import type { OverviewView } from '@/core/overview/OverviewView'
import { pitchRange } from '@/core/overview/pitchRange'
import { zoomAround } from '@/core/overview/zoomAround'
import type { Note } from '@/core/song/Note'

import { rollScale } from '../overview/rollScale'
import { useElementSize } from '../overview/useElementSize'

/**
 * One piano-roll lane of the Review hands page, on the overview's geometry. A lane with
 * `describe` is the editable one: a click flips a note, and the whole lane is one Tab stop — a
 * real button over the focused note, moved with ←/→ (time order), Home and End; Enter or Space
 * flips. Drag pans, Ctrl/⌘ + wheel zooms, the wheel pans.
 */
const props = defineProps<{
  /** In time order. */
  readonly notes: readonly Note[]
  readonly layout: BarLayout
  readonly view: OverviewView
  /** CSS colour of each note; null = not drawn (Hidden). */
  readonly colors: readonly (string | null)[]
  readonly flipped?: ReadonlySet<string>
  readonly uncertain?: ReadonlySet<string>
  /** Notes the compared method gives the other hand. */
  readonly differs?: ReadonlySet<string>
  /** A note's accessible name; makes the lane editable. */
  readonly describe?: (index: number) => string
  readonly label: string
}>()
const emit = defineEmits<{ view: [view: OverviewView]; flip: [index: number] }>()

const FRAME = { padLeft: 8, padRight: 34 }
/** Room for the bar numbers above the notes. */
const TOP = 22
const DRAG_PX = 5

const box = useTemplateRef<HTMLElement>('box')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const cursorButton = useTemplateRef<HTMLButtonElement>('cursorButton')
const size = useElementSize(box)
const scale = computed(() => rollScale(props.view, size.value.width, FRAME))
const editable = computed(() => props.describe !== undefined)
const pitches = computed(() => pitchRange(props.notes))
const longest = computed(() =>
  props.notes.reduce((most, n) => Math.max(most, n.endTick - n.startTick), 0),
)
const top = computed(() => (editable.value ? TOP : 4))
const rowHeight = computed(
  () =>
    Math.max(20, size.value.height - top.value - 6) / (pitches.value.high - pitches.value.low + 1),
)

function boxOf(index: number): NoteBox | null {
  const n = props.notes[index]
  if (n === undefined) return null
  const height = Math.min(12, Math.max(2, rowHeight.value * 0.9))
  const rowTop = top.value + (pitches.value.high - n.midi) * rowHeight.value
  return {
    index,
    x: scale.value.x(n.startTick),
    y: rowTop + (rowHeight.value - height) / 2,
    width: Math.max(2, (n.endTick - n.startTick) * scale.value.pxPerTick - 1),
    height,
  }
}

/** The boxes of the notes drawn in the view. */
const boxes = computed(() => {
  const { startTick, span } = props.view
  const range = notesInView(props.notes, longest.value, startTick, startTick + span)
  const out: NoteBox[] = []
  for (let i = range.from; i < range.to; i++) {
    if (props.colors[i] === null || (props.notes[i]?.endTick ?? 0) <= startTick) continue
    const b = boxOf(i)
    if (b !== null) out.push(b)
  }
  return out
})

// ---- Drawing ------------------------------------------------------------------------------

let request = 0
function draw(): void {
  request = 0
  const el = canvas.value
  const host = box.value
  const { width, height } = size.value
  if (el === null || host === null || width === 0) return
  const dpr = window.devicePixelRatio || 1
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  const ctx = el.getContext('2d')
  if (ctx === null) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const style = getComputedStyle(host)
  /** A canvas can't use var(…): theme colours are read from the lane. */
  const css = (color: string) => {
    const name = /^var\((--[\w-]+)\)$/.exec(color)?.[1]
    return name === undefined ? color : style.getPropertyValue(name).trim()
  }
  const left = FRAME.padLeft
  const right = width - FRAME.padRight
  const s = scale.value
  const { layout, view } = props

  ctx.font = `10px ${style.fontFamily}`
  ctx.textBaseline = 'middle'
  if (editable.value) {
    ctx.textAlign = 'left'
    for (const midi of [48, 60, 72]) {
      if (midi < pitches.value.low || midi > pitches.value.high) continue
      const y = Math.round(top.value + (pitches.value.high - midi + 0.5) * rowHeight.value) + 0.5
      ctx.strokeStyle = 'rgb(255 255 255 / 8%)'
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.stroke()
      ctx.fillStyle = '#8f9ab6'
      ctx.fillText(noteName(midi), right + 6, y)
    }
  }
  const bars = layout.bars.filter(
    (b) => b.endTick > view.startTick && b.startTick < view.startTick + view.span,
  )
  const step = labelStep((view.span / Math.max(1, bars.length)) * s.pxPerTick)
  for (const bar of bars) {
    const x = Math.round(s.x(bar.startTick)) + 0.5
    if (x < left - 1 || x > right + 1) continue
    if (bar.bar >= 1 && !isLabelledBar(bar.bar, step)) continue
    ctx.strokeStyle = 'rgb(255 255 255 / 8%)'
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
    if (editable.value && bar.bar >= 1) {
      ctx.fillStyle = '#8f9ab6'
      ctx.fillText(String(bar.bar), x + 5, 11)
    }
  }

  ctx.save()
  ctx.beginPath()
  ctx.rect(left - 4, 0, right - left + 8, height)
  ctx.clip()
  for (const b of boxes.value) {
    const note = props.notes[b.index] as Note
    const color = css(props.colors[b.index] ?? '#fff')
    const radius = Math.min(4, b.height / 2, b.width / 2)
    const path = new Path2D()
    path.roundRect(b.x, b.y, b.width, b.height, radius)
    ctx.fillStyle = color
    if (props.uncertain?.has(note.id) === true) {
      ctx.globalAlpha = 0.35
      ctx.fill(path)
      ctx.globalAlpha = 1
      ctx.save()
      ctx.clip(path)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let x = b.x - b.height; x < b.x + b.width; x += 6) {
        ctx.moveTo(x, b.y + b.height)
        ctx.lineTo(x + b.height, b.y)
      }
      ctx.stroke()
      ctx.restore()
    } else ctx.fill(path)
    const outline = (grow: number) => {
      const around = new Path2D()
      around.roundRect(
        b.x - grow,
        b.y - grow,
        b.width + 2 * grow,
        b.height + 2 * grow,
        radius + grow,
      )
      ctx.strokeStyle = '#fff'
      ctx.stroke(around)
    }
    if (props.flipped?.has(note.id) === true) {
      ctx.lineWidth = 2
      outline(1)
    }
    if (props.differs?.has(note.id) === true) {
      ctx.lineWidth = 1.5
      ctx.setLineDash([3, 2])
      outline(3)
      ctx.setLineDash([])
    }
  }
  ctx.restore()
}

function schedule(): void {
  if (request === 0) request = requestAnimationFrame(draw)
}
watch(
  () => [boxes.value, size.value, props.colors, props.flipped, props.uncertain, props.differs],
  schedule,
  { immediate: true, flush: 'post' },
)
onBeforeUnmount(() => cancelAnimationFrame(request))

// ---- The focused note ---------------------------------------------------------------------

const cursor = ref(0)
const focused = ref(false)
const shown = (index: number) => props.notes[index] !== undefined && props.colors[index] !== null
/** The nearest note that is drawn, from `index` in direction `step` (or itself). */
function shownFrom(index: number, step: 1 | -1): number | null {
  for (let i = index; i >= 0 && i < props.notes.length; i += step) if (shown(i)) return i
  return null
}
watch(
  () => [props.notes, props.colors] as const,
  () => {
    if (shown(cursor.value)) return
    cursor.value = shownFrom(cursor.value, 1) ?? shownFrom(cursor.value, -1) ?? 0
  },
  { immediate: true },
)
const cursorBox = computed(() => (shown(cursor.value) ? boxOf(cursor.value) : null))
const cursorName = computed(() => {
  // A flip changes the hands behind `describe`: follow the colours too.
  void props.colors
  return cursorBox.value === null ? '' : (props.describe?.(cursor.value) ?? '')
})
const inView = computed(() => {
  const b = cursorBox.value
  return b !== null && b.x + b.width >= FRAME.padLeft && b.x <= size.value.width - FRAME.padRight
})

function reveal(index: number): void {
  const n = props.notes[index]
  if (n === undefined) return
  const { startTick, span } = props.view
  if (n.startTick >= startTick && n.startTick <= startTick + span * 0.95) return
  emit('view', clampView({ startTick: n.startTick - span * 0.25, span }, props.layout))
}

function moveTo(index: number | null): void {
  if (index === null) return
  cursor.value = index
  reveal(index)
}

function onCursorKey(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  switch (event.key) {
    case 'ArrowRight':
      moveTo(shownFrom(cursor.value + 1, 1))
      break
    case 'ArrowLeft':
      moveTo(shownFrom(cursor.value - 1, -1))
      break
    case 'Home':
      moveTo(shownFrom(0, 1))
      break
    case 'End':
      moveTo(shownFrom(props.notes.length - 1, -1))
      break
    default:
      return
  }
  event.preventDefault()
}

function onCursorFocus(): void {
  focused.value = true
  reveal(cursor.value)
}

// ---- Pointer ------------------------------------------------------------------------------

let press: { id: number; x: number; startTick: number; moved: boolean } | null = null

function local(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const rect = box.value?.getBoundingClientRect()
  return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
}

function onPointerDown(event: PointerEvent): void {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  press = { id: event.pointerId, x: local(event).x, startTick: props.view.startTick, moved: false }
  box.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (press === null || press.id !== event.pointerId) return
  const dx = local(event).x - press.x
  if (!press.moved && Math.abs(dx) < DRAG_PX) return
  press.moved = true
  const startTick = press.startTick - dx / scale.value.pxPerTick
  emit('view', clampView({ startTick, span: props.view.span }, props.layout))
}

async function onPointerUp(event: PointerEvent): Promise<void> {
  const done = press
  if (done?.id !== event.pointerId) return
  press = null
  if (done.moved || !editable.value) return
  const { x, y } = local(event)
  const hit = noteAt(boxes.value, x, y)
  if (hit === null) return
  cursor.value = hit
  emit('flip', hit)
  await nextTick()
  cursorButton.value?.focus({ preventScroll: true })
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  if (event.ctrlKey || event.metaKey) {
    const factor = Math.exp(Math.max(-60, Math.min(60, event.deltaY)) * 0.004)
    emit('view', zoomAround(props.view, factor, scale.value.tick(local(event).x), props.layout))
    return
  }
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  const startTick = props.view.startTick + delta / scale.value.pxPerTick
  emit('view', clampView({ startTick, span: props.view.span }, props.layout))
}
</script>

<template>
  <div
    ref="box"
    class="hand-roll"
    :class="{ editable }"
    role="group"
    :aria-label="label"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="press = null"
    @wheel="onWheel"
  >
    <canvas ref="canvas" class="layer" aria-hidden="true" />
    <template v-if="editable && cursorBox">
      <button
        ref="cursorButton"
        type="button"
        class="cursor"
        :class="{ away: !inView }"
        :style="{
          left: `${cursorBox.x - 3}px`,
          top: `${cursorBox.y - 3}px`,
          width: `${cursorBox.width + 6}px`,
          height: `${cursorBox.height + 6}px`,
        }"
        :aria-label="cursorName"
        data-owns-arrows
        data-testid="hand-note"
        @click="emit('flip', cursor)"
        @keydown="onCursorKey"
        @focus="onCursorFocus"
        @blur="focused = false"
      />
      <!-- The one button changes its name as it moves: say so. -->
      <span class="visually-hidden" aria-live="polite">{{ focused ? cursorName : '' }}</span>
    </template>
  </div>
</template>

<style scoped>
.hand-roll {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: rgb(255 255 255 / 3%);
  touch-action: none;
  user-select: none;
}

.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.editable {
  cursor: pointer;
}

/* The pointer goes to the canvas under it; the button is for the keyboard and screen readers. */
.cursor {
  position: absolute;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  pointer-events: none;
}

.cursor:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.cursor.away {
  opacity: 0;
}
</style>
