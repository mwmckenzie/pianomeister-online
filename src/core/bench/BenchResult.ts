import type { BenchCell, BenchSuite } from './BenchCell'
import type { GpuClass } from './classifyGpu'

export const BENCH_SCHEMA = 'pianomeister-bench'
export const BENCH_VERSION = 1

/** Frame intervals (ms) summed up. Dropped: longer than 1.5 × the budget. */
export interface FrameStats {
  readonly frames: number
  readonly fps: number
  readonly median: number
  readonly p95: number
  readonly p99: number
  readonly longest: number
  /** Shares (0–1) of frames over the targets, as written and with room for timer jitter. */
  readonly over17: number
  readonly over18: number
  readonly over34: number
  readonly over35: number
  readonly dropped: number
}

/** A per-frame cost in ms. The mean says most: browsers round their timers to 0.1 ms. */
export interface CostStats {
  readonly mean: number
  readonly median: number
  readonly p95: number
}

export interface LongTasks {
  readonly count: number
  readonly totalMs: number
  readonly longestMs: number
  /** Where the long animation frames' script time went, most first. */
  readonly scripts: readonly { readonly name: string; readonly ms: number }[]
}

export interface AudioStats {
  /** Seconds between a note being handed over and its time; negative: late. */
  readonly marginMin: number | null
  readonly marginP5: number | null
  readonly handed: number
  readonly late: number
  /** Notes the song has there; null where the segment jumps about. */
  readonly expected: number | null
  readonly missing: number | null
  /** How far the audio clock ran from the wall clock over the cell, in ms. */
  readonly driftMs: number
  readonly outputLatencyMs: number | null
}

export interface CellResult {
  readonly cell: BenchCell
  readonly seconds: number
  readonly frames: FrameStats
  /** The longest warm-up frame, apart: programs compile there. */
  readonly warmUpLongest: number
  /** The engine's CPU time per frame. */
  readonly cpu: CostStats
  readonly hud: CostStats
  readonly gpuMs: number | null
  readonly longTasks: LongTasks | null
  /** Song-position steps against frame intervals, in ms; null while not playing straight on. */
  readonly motionErrorP95: number | null
  readonly audio: AudioStats
  readonly renderer: {
    readonly drawCalls: number
    readonly triangles: number
    readonly points: number
    readonly programs: number
    readonly geometries: number
    readonly textures: number
    readonly width: number
    readonly height: number
    /** Render targets, estimated from their sizes (browsers don't tell). */
    readonly targetBytes: number
  }
  readonly heapStart: number | null
  readonly heapEnd: number | null
  /** Raw frame intervals, ms; left out of stored summaries. */
  readonly intervals?: readonly number[]
}

export interface DeviceInfo {
  readonly gpu: string | null
  readonly gpuClass: GpuClass
  readonly gpuRule: string
  readonly webgl2: boolean
  readonly gpuTimer: boolean
  readonly floatTargets: boolean
  readonly maxTextureSize: number
  readonly cores: number | null
  readonly memoryGb: number | null
  readonly screen: readonly [number, number]
  readonly viewport: readonly [number, number]
  readonly pixelRatio: number
  readonly refreshMs: number
  readonly reducedMotion: boolean
  readonly userAgent: string
}

export interface BenchRun {
  readonly schema: typeof BENCH_SCHEMA
  readonly version: typeof BENCH_VERSION
  readonly id: string
  /** ISO 8601. */
  readonly at: string
  readonly suite: BenchSuite
  readonly label: string
  readonly notes: string
  readonly app: { readonly version: string; readonly commit: string; readonly dev: boolean }
  readonly device: DeviceInfo
  /** Milliseconds from navigation; null where it wasn't seen. */
  readonly startUp: {
    readonly firstPaint: number | null
    readonly songOpened: number | null
    readonly samplesLoaded: number | null
  }
  readonly flags: readonly string[]
  readonly cells: readonly CellResult[]
}
