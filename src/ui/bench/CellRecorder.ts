import type { BenchSegment } from '@/core/bench/BenchCell'
import type { AudioStats, CellResult, LongTasks } from '@/core/bench/BenchResult'
import { costStats, frameStats, percentile } from '@/core/bench/stats'

import type { BenchHost } from './BenchHost'

interface LoafScript {
  readonly duration: number
  readonly invoker?: string
  readonly sourceFunctionName?: string
  readonly sourceURL?: string
}
type LoafEntry = PerformanceEntry & { readonly scripts?: readonly LoafScript[] }

/** A handover this much after the note's time is late (an exact start is a hair behind). */
const LATE_SEC = 0.005
/** Segments that play straight on: notes and motion can be checked against the song. */
const STRAIGHT: ReadonlySet<BenchSegment> = new Set(['dense', 'normal', 'light'])

const heap = (): number | null =>
  (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
  null

/**
 * Records one cell: attach() before playback starts (notes are handed over ahead of time),
 * start() once the warm-up is over, stop() for the numbers.
 */
export class CellRecorder {
  private intervals: number[] = []
  private cpu: number[] = []
  private hud: number[] = []
  private motion: number[] = []
  private calls: number[] = []
  private notes: { readonly time: number; readonly now: number }[] = []
  private long: LoafEntry[] = []
  private observer: PerformanceObserver | null = null
  private sampler = 0
  private lastNow: number | null = null
  private lastSong: number | null = null
  private recording = false
  private warmUpLongest = 0
  private began = { at: 0, audio: 0, song: 0, heap: null as number | null }

  constructor(
    private readonly host: BenchHost,
    private readonly segment: BenchSegment,
    private readonly refreshMs: number,
  ) {}

  attach(): void {
    const engine = this.host.engine()
    const session = this.host.session()
    if (engine === null || session === null) return
    engine.onFrame = (now, cpuMs) => this.frame(now, cpuMs)
    this.host.setHudListener((ms) => {
      if (this.recording) this.hud.push(ms)
    })
    session.output.onNote = (time, now) => this.notes.push({ time, now })
    const types = PerformanceObserver.supportedEntryTypes
    const type = types.includes('long-animation-frame')
      ? 'long-animation-frame'
      : types.includes('longtask')
        ? 'longtask'
        : null
    if (type !== null) {
      this.observer = new PerformanceObserver((list) => {
        if (this.recording) this.long.push(...(list.getEntries() as LoafEntry[]))
      })
      this.observer.observe({ type })
    }
    this.sampler = window.setInterval(() => {
      const info = engine.renderInfo()
      if (this.recording && info !== null) this.calls.push(info.drawCalls)
    }, 250)
  }

  start(): void {
    const session = this.host.session()
    this.host.engine()?.resetGpuTimer()
    this.lastNow = null
    this.lastSong = null
    this.recording = true
    this.began = {
      at: performance.now(),
      audio: session?.context.currentTime ?? 0,
      song: session?.transport.position ?? 0,
      heap: heap(),
    }
  }

  /** Detaches from the player, whatever happened. */
  detach(): void {
    const engine = this.host.engine()
    const session = this.host.session()
    if (engine !== null) engine.onFrame = null
    if (session !== null) session.output.onNote = null
    this.host.setHudListener(null)
    this.observer?.disconnect()
    window.clearInterval(this.sampler)
    this.recording = false
  }

  stop(): Omit<CellResult, 'cell'> | null {
    const info = this.host.engine()?.renderInfo() ?? null
    const session = this.host.session()
    if (info === null || session === null) return null
    const seconds = (performance.now() - this.began.at) / 1000
    const audio = this.audioStats(seconds, session.context.currentTime, session.transport.position)
    const result = {
      seconds,
      frames: frameStats(this.intervals, this.refreshMs),
      warmUpLongest: Number(this.warmUpLongest.toFixed(1)),
      cpu: costStats(this.cpu),
      hud: costStats(this.hud),
      gpuMs: info.gpuMs,
      longTasks: this.longTasks(),
      motionErrorP95:
        this.motion.length === 0 ? null : Number(percentile(this.motion, 95).toFixed(2)),
      audio,
      renderer: {
        drawCalls: percentile(this.calls, 50) || info.drawCalls,
        triangles: info.triangles,
        points: info.points,
        programs: info.programs,
        geometries: info.geometries,
        textures: info.textures,
        width: info.width,
        height: info.height,
        targetBytes: info.targetBytes,
      },
      heapStart: this.began.heap,
      heapEnd: heap(),
      intervals: this.intervals.map((i) => Number(i.toFixed(2))),
    }
    this.detach()
    return result
  }

  private frame(now: number, cpuMs: number): void {
    const interval = this.lastNow === null ? null : now - this.lastNow
    this.lastNow = now
    if (!this.recording) {
      if (interval !== null) this.warmUpLongest = Math.max(this.warmUpLongest, interval)
      return
    }
    this.cpu.push(cpuMs)
    if (interval !== null) this.intervals.push(interval)
    if (!STRAIGHT.has(this.segment)) return
    const session = this.host.session()
    const map = session?.song?.tempoMap
    if (session === null || map === undefined) return
    const song = map.tickToSeconds(session.audibleTick()) * 1000
    if (this.lastSong !== null && interval !== null) {
      this.motion.push(Math.abs(song - this.lastSong - interval))
    }
    this.lastSong = song
  }

  private longTasks(): LongTasks | null {
    if (this.observer === null) return null
    const mine = this.long.filter((e) => e.startTime >= this.began.at)
    const scripts = new Map<string, number>()
    for (const script of mine.flatMap((e) => e.scripts ?? [])) {
      const file = script.sourceURL?.split('/').pop()?.split('?')[0] ?? ''
      const name = [script.invoker, script.sourceFunctionName, file].filter((s) => s).join(' · ')
      scripts.set(name, (scripts.get(name) ?? 0) + script.duration)
    }
    return {
      count: mine.length,
      totalMs: Math.round(mine.reduce((sum, e) => sum + e.duration, 0)),
      longestMs: Math.round(mine.reduce((max, e) => Math.max(max, e.duration), 0)),
      scripts: [...scripts]
        .map(([name, ms]) => ({ name, ms: Math.round(ms) }))
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 5),
    }
  }

  private audioStats(seconds: number, audioNow: number, songNow: number): AudioStats {
    const session = this.host.session()
    const { audio, song } = this.began
    const mine = this.notes.filter((n) => n.time >= audio && n.time < audioNow)
    const margins = mine.map((n) => n.time - n.now)
    const expected = STRAIGHT.has(this.segment)
      ? (session?.transport.notesStartingIn(song, songNow).length ?? null)
      : null
    const latency = session?.context.outputLatency
    return {
      marginMin: margins.length === 0 ? null : Number(Math.min(...margins).toFixed(4)),
      marginP5: margins.length === 0 ? null : Number(percentile(margins, 5).toFixed(4)),
      handed: mine.length,
      late: margins.filter((m) => m < -LATE_SEC).length,
      expected,
      missing: expected === null ? null : Math.max(0, expected - mine.length),
      driftMs: Number(((audioNow - audio - seconds) * 1000).toFixed(1)),
      outputLatencyMs: latency === undefined ? null : Math.round(latency * 1000),
    }
  }
}
