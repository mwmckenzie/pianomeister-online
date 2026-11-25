import type { DeviceInfo } from '@/core/bench/BenchResult'
import { classifyGpu } from '@/core/bench/classifyGpu'
import { percentile } from '@/core/bench/stats'
import type { Engine } from '@/engine/Engine'

/** The screen's frame interval in ms, from a second of empty frames. */
export function measureRefresh(): Promise<number> {
  return new Promise((resolve) => {
    const intervals: number[] = []
    let start = 0
    let last = 0
    const step = (now: number) => {
      if (last !== 0) intervals.push(now - last)
      else start = now
      last = now
      if (now - start < 1000) requestAnimationFrame(step)
      else resolve(Number(percentile(intervals, 50).toFixed(2)))
    }
    requestAnimationFrame(step)
  })
}

/** What the browser tells about this device. Stays here until the player downloads it. */
export function readDevice(engine: Engine, refreshMs: number): DeviceInfo {
  const gpu = engine.gpuInfo()
  const verdict = classifyGpu(gpu?.renderer ?? null)
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return {
    gpu: gpu?.renderer ?? null,
    gpuClass: verdict.gpuClass,
    gpuRule: verdict.rule,
    // The renderer needs it, so an engine that draws has it.
    webgl2: gpu !== null,
    gpuTimer: gpu?.timer ?? false,
    floatTargets: gpu?.floatTargets ?? false,
    maxTextureSize: gpu?.maxTextureSize ?? 0,
    cores: navigator.hardwareConcurrency || null,
    memoryGb: memory ?? null,
    screen: [screen.width, screen.height],
    viewport: [window.innerWidth, window.innerHeight],
    pixelRatio: Number(window.devicePixelRatio.toFixed(3)),
    refreshMs,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    userAgent: navigator.userAgent,
  }
}
