<script setup lang="ts">
import { computed, onBeforeUnmount, useTemplateRef, watch } from 'vue'

import type { HandNote } from '@/core/hands/HandNote'
import type { BarLayout } from '@/core/overview/BarLayout'
import type { OverviewView } from '@/core/overview/OverviewView'
import { pitchRange } from '@/core/overview/pitchRange'
import { notePaletteColors } from '@/core/color/notePaletteColors'
import type { LoopRange } from '@/core/transport/LoopRange'

import { useSettingsStore } from '../stores/settingsStore'
import { readThemeColors } from './readThemeColors'
import type { RollFrame } from './RollFrame'
import { rollScale } from './rollScale'
import { useElementSize } from './useElementSize'

/**
 * The loop editor's minimap (brief decision 106, QGOverviewB): the whole song in 46 px, the
 * loop range marked, and the current view as a window that drags to pan (a press elsewhere
 * centres the view there).
 */
const props = defineProps<{
  readonly notes: readonly HandNote[]
  readonly layout: BarLayout
  readonly view: OverviewView
  readonly frame: Pick<RollFrame, 'padLeft' | 'padRight'>
  readonly hands: { readonly right: boolean; readonly left: boolean }
  readonly loop: LoopRange | null
}>()
const emit = defineEmits<{ view: [view: OverviewView] }>()
const settings = useSettingsStore()
/** The same note colours as the highway (Note colours, brief decision 122). */
const palette = computed(() => notePaletteColors(settings.settings.notes, settings.noteColourSets))

const box = useTemplateRef<HTMLElement>('box')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const size = useElementSize(box)
const whole = computed((): OverviewView => ({
  startTick: props.layout.startTick,
  span: props.layout.endTick - props.layout.startTick,
}))
const scale = computed(() => rollScale(whole.value, size.value.width, props.frame))
const windowBox = computed(() => {
  const s = scale.value
  const left = s.x(props.view.startTick)
  return { left, width: Math.max(8, s.x(props.view.startTick + props.view.span) - left) }
})

let request = 0
function draw(): void {
  request = 0
  const el = canvas.value
  const { width, height } = size.value
  if (el === null || width === 0 || box.value === null) return
  const dpr = window.devicePixelRatio || 1
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  const ctx = el.getContext('2d')
  if (ctx === null) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const s = scale.value
  for (const bar of props.layout.bars) {
    if (bar.bar < 1 || (!bar.strong && s.pxPerTick * (bar.endTick - bar.startTick) < 4)) continue
    ctx.fillStyle = bar.strong ? 'rgb(255 255 255 / 10%)' : 'rgb(255 255 255 / 4%)'
    ctx.fillRect(Math.round(s.x(bar.startTick)), 6, 1, 34)
  }
  const loop = props.loop
  if (loop !== null) {
    const a = props.layout.bars.find((b) => b.bar === loop.startBar)
    const z = props.layout.bars.find((b) => b.bar === loop.endBar)
    const x0 = s.x(a?.startTick ?? 0)
    ctx.fillStyle = `rgb(${readThemeColors(box.value).secondary} / 18%)`
    ctx.fillRect(x0, 2, s.x(z?.endTick ?? 0) - x0, height - 4)
  }
  const { low, high } = pitchRange(props.notes)
  const rowHeight = (height - 12) / (high - low + 1)
  for (const n of props.notes) {
    if (n.hand === 'right' ? !props.hands.right : !props.hands.left) continue
    ctx.globalAlpha = n.hand === 'left' ? 0.5 : 1
    ctx.fillStyle = palette.value[n.midi % 12] ?? '#FFFFFF'
    const y = height - 6 - (n.midi - low + 1) * rowHeight
    ctx.fillRect(s.x(n.startTick), y, Math.max(1, (n.endTick - n.startTick) * s.pxPerTick), 2)
  }
  ctx.globalAlpha = 1
}

watch(
  () => [
    size.value,
    props.notes,
    props.hands.right,
    props.hands.left,
    props.loop,
    props.layout,
    palette.value,
  ],
  () => {
    if (request === 0) request = requestAnimationFrame(draw)
  },
  { immediate: true },
)
onBeforeUnmount(() => cancelAnimationFrame(request))

let drag: { readonly x: number; readonly start: number } | null = null

function onPointerDown(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const el = box.value
  if (el === null) return
  el.setPointerCapture(event.pointerId)
  const x = event.clientX - el.getBoundingClientRect().left
  const { left, width } = windowBox.value
  let start = props.view.startTick
  if (x < left || x > left + width) {
    // Outside the window: centre the view on that point, then drag from there.
    start = scale.value.tick(x) - props.view.span / 2
    emit('view', { startTick: start, span: props.view.span })
  }
  drag = { x, start }
}

function onPointerMove(event: PointerEvent): void {
  const d = drag
  const el = box.value
  if (d === null || el === null) return
  const x = event.clientX - el.getBoundingClientRect().left
  emit('view', { startTick: d.start + (x - d.x) / scale.value.pxPerTick, span: props.view.span })
}

function onPointerUp(): void {
  drag = null
}
</script>

<template>
  <div
    ref="box"
    class="minimap"
    role="presentation"
    data-testid="minimap"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <canvas ref="canvas" class="layer" aria-hidden="true" />
    <div
      class="window"
      :style="{ left: `${windowBox.left}px`, width: `${windowBox.width}px` }"
      data-testid="minimap-window"
    />
  </div>
</template>

<style scoped>
.minimap {
  position: relative;
  height: 46px;
  touch-action: none;
  cursor: pointer;
  user-select: none;
}

.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.window {
  position: absolute;
  top: 2px;
  height: 42px;
  box-sizing: border-box;
  border: 1px solid var(--primary);
  border-radius: 6px;
  background: rgb(var(--primary-rgb) / 10%);
  cursor: grab;
}
</style>
