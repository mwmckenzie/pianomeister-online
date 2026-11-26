<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import { classifyGpu } from '@/core/bench/classifyGpu'
import { percentile } from '@/core/bench/stats'

import { useSettingsStore } from '../stores/settingsStore'
import { benchHostKey } from './BenchHost'

/**
 * Frame times, renderer counts and the GPU in a corner (milestone 11: `?perf=1`, Ctrl+Alt+P).
 * Drawn four times a second, on a canvas, so it hardly shows up in what it measures; `quiet`
 * (the benchmark's page) hides it and stops it altogether.
 */
const props = defineProps<{ readonly quiet: boolean }>()
const host = inject(benchHostKey)
const settings = useSettingsStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

const WIDTH = 300
const HEIGHT = 168
const GRAPH = { top: 112, height: 50, frames: 120, ms: 50 }
const WINDOW = 400

const frames: { at: number; ms: number; cpu: number }[] = []
let margin: number | null = null
let hudMs = 0
let last: number | null = null
let timer = 0

function onFrame(now: number, cpu: number): void {
  if (last !== null) frames.push({ at: now, ms: now - last, cpu })
  last = now
  if (frames.length > WINDOW) frames.splice(0, frames.length - WINDOW)
}

function draw(): void {
  const ctx = canvas.value?.getContext('2d')
  const engine = host?.engine()
  const info = engine?.renderInfo()
  // The wait for the next frame isn't a slow frame.
  if (engine?.resting) last = null
  // The benchmark takes these over and gives them back empty.
  attach()
  if (!ctx || !engine || !info || props.quiet) return
  const now = frames.at(-1)?.at ?? 0
  const recent = frames.filter((f) => f.at > now - 3000).map((f) => f.ms)
  const fps = recent.length === 0 ? 0 : (recent.length * 1000) / recent.reduce((a, b) => a + b, 0)
  const cpu = percentile(
    frames.slice(-GRAPH.frames).map((f) => f.cpu),
    50,
  )
  const gpu = engine.gpuInfo()?.renderer ?? null
  const lines = [
    engine.resting ? 'idle' : `${fps.toFixed(0)} fps · p95 ${percentile(recent, 95).toFixed(1)} ms`,
    `engine ${cpu.toFixed(2)} · HUD ${hudMs.toFixed(2)} · GPU ${info.gpuMs?.toFixed(1) ?? 'n/a'} ms`,
    `${info.drawCalls} calls · ${(info.triangles / 1000).toFixed(0)}k triangles · ${info.programs} programs`,
    `${settings.settings.render.quality} · ${info.width}×${info.height} @ ${info.pixelRatio.toFixed(2)} · ${info.antialias}`,
    `audio ahead ${margin === null ? 'n/a' : `${(margin * 1000).toFixed(0)} ms`}`,
    `${classifyGpu(gpu).gpuClass}: ${(gpu ?? 'GPU hidden').slice(0, 44)}`,
  ]
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  ctx.font = '11px monospace'
  ctx.fillStyle = '#e6ebf5'
  lines.forEach((line, i) => ctx.fillText(line, 8, 16 + i * 16))
  const y = (ms: number) => GRAPH.top + GRAPH.height * (1 - Math.min(1, ms / GRAPH.ms))
  ctx.fillStyle = 'rgb(255 255 255 / 25%)'
  for (const ms of [1000 / 60, 1000 / 30]) ctx.fillRect(8, y(ms), WIDTH - 16, 1)
  const bar = (WIDTH - 16) / GRAPH.frames
  frames.slice(-GRAPH.frames).forEach((f, i) => {
    ctx.fillStyle = f.ms > 35 ? '#ff6b6b' : f.ms > 18 ? '#ffd166' : '#7ee0c3'
    ctx.fillRect(8 + i * bar, y(f.ms), Math.max(1, bar - 0.5), GRAPH.top + GRAPH.height - y(f.ms))
  })
}

function attach(): void {
  const engine = host?.engine()
  const session = host?.session()
  if (props.quiet) return
  if (engine && engine.onFrame === null) engine.onFrame = onFrame
  if (session && session.output.onNote === null) {
    session.output.onNote = (time, now) => (margin = time - now)
  }
  host?.setHudListener((ms) => (hudMs = ms))
}

onMounted(() => (timer = window.setInterval(draw, 250)))
onBeforeUnmount(() => {
  window.clearInterval(timer)
  const engine = host?.engine()
  const session = host?.session()
  if (engine && engine.onFrame === onFrame) {
    engine.onFrame = null
    if (session) session.output.onNote = null
    host?.setHudListener(null)
  }
})
</script>

<template>
  <canvas
    v-show="!quiet"
    ref="canvas"
    class="perf"
    :width="WIDTH"
    :height="HEIGHT"
    aria-hidden="true"
    data-testid="perf-overlay"
  />
</template>

<style scoped>
.perf {
  position: fixed;
  z-index: 60;
  bottom: 8px;
  left: 8px;
  border-radius: 8px;
  background: rgb(5 7 15 / 80%);
  pointer-events: none;
}
</style>
