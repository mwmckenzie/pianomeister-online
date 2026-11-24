<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import { useElementSize } from '../overview/useElementSize'
import { useSettingsStore } from '../stores/settingsStore'
import { useReducedMotion } from '../theme/useReducedMotion'

/**
 * A small highway over two octaves in a set's colours. Flat on purpose: the playfield's other
 * fills are shaders, so they show as solid here. Still under reduced motion.
 */
const props = defineProps<{ readonly colours: readonly string[] }>()
const settings = useSettingsStore()
const reduced = useReducedMotion()
const box = useTemplateRef<HTMLElement>('box')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const size = useElementSize(box)

const WHITES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23]
const KEYS_HEIGHT = 56
/** Seconds for the pattern to pass once. */
const LOOP_SEC = 12
/** [semitone, start, length] in parts of the pattern; all twelve pitch classes are in it. */
const NOTES: readonly (readonly [number, number, number])[] = [
  [0, 0, 0.16],
  [4, 0.04, 0.12],
  [7, 0.04, 0.12],
  [13, 0.12, 0.06],
  [12, 0.22, 0.1],
  [3, 0.2, 0.1],
  [11, 0.34, 0.08],
  [5, 0.34, 0.12],
  [1, 0.42, 0.08],
  [9, 0.46, 0.08],
  [8, 0.5, 0.06],
  [7, 0.58, 0.12],
  [10, 0.62, 0.06],
  [2, 0.64, 0.08],
  [16, 0.7, 0.1],
  [6, 0.76, 0.06],
  [14, 0.8, 0.08],
  [21, 0.84, 0.1],
  [18, 0.9, 0.06],
]

function laneOf(semitone: number, lane: number): { x: number; width: number; black: boolean } {
  const white = WHITES.indexOf(semitone)
  if (white >= 0) return { x: white * lane, width: lane, black: false }
  const below = WHITES.indexOf(semitone - 1)
  return { x: (below + 1) * lane - lane * 0.32, width: lane * 0.64, black: true }
}

function draw(progress: number): void {
  const ctx = canvas.value?.getContext('2d')
  const { width, height } = size.value
  if (!ctx || canvas.value === null || width === 0) return
  const ratio = window.devicePixelRatio
  canvas.value.width = Math.round(width * ratio)
  canvas.value.height = Math.round(height * ratio)
  ctx.scale(ratio, ratio)
  const { colors, noteStyle } = settings.settings
  const floor = height - KEYS_HEIGHT
  const lane = width / WHITES.length
  ctx.fillStyle = colors.highway
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = 'rgb(255 255 255 / 6%)'
  for (let i = 1; i < WHITES.length; i++) ctx.fillRect(i * lane, 0, 1, floor)

  const sounding = new Map<number, string>()
  for (const [semitone, start, length] of NOTES) {
    const colour = props.colours[semitone % 12] as string
    const { x, width: w } = laneOf(semitone, lane)
    // The pattern repeats: the part that has passed comes round again from the top.
    for (const turn of [0, 1]) {
      const bottom = floor * (1 - (start + turn - progress))
      const top = bottom - floor * length
      if (top >= floor || bottom <= 0) continue
      if (bottom >= floor) sounding.set(semitone, colour)
      if (noteStyle.sustainFill === 'gradient') {
        const fill = ctx.createLinearGradient(0, bottom, 0, top)
        fill.addColorStop(0, colour)
        fill.addColorStop(1, `${colour}55`)
        ctx.fillStyle = fill
      } else ctx.fillStyle = colour
      ctx.beginPath()
      ctx.roundRect(x + 2, top, w - 4, Math.min(bottom, floor) - top, 4)
      ctx.fill()
    }
  }

  for (const pass of [false, true]) {
    for (let semitone = 0; semitone < 24; semitone++) {
      const { x, width: w, black } = laneOf(semitone, lane)
      if (black !== pass) continue
      ctx.fillStyle = sounding.get(semitone) ?? (black ? '#1a2034' : '#e9ecf4')
      ctx.fillRect(x + (black ? 0 : 1), floor, black ? w : w - 1, black ? 34 : KEYS_HEIGHT)
    }
  }
}

let frame = 0
/** Still: a moment with notes from both halves of the pattern in view. */
const STILL = 0.05
function step(now: number): void {
  draw((now / 1000 / LOOP_SEC) % 1)
  frame = requestAnimationFrame(step)
}
function restart(): void {
  cancelAnimationFrame(frame)
  if (reduced.value) draw(STILL)
  else frame = requestAnimationFrame(step)
}
onMounted(restart)
watch([reduced, () => props.colours, size, () => settings.settings], restart, { flush: 'post' })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div ref="box" class="preview" data-testid="colour-preview">
    <canvas ref="canvas" role="img" aria-label="Notes in this set's colours" />
  </div>
</template>

<style scoped>
.preview {
  position: relative;
  min-height: 220px;
  overflow: hidden;
  border-radius: 14px;
}

canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
