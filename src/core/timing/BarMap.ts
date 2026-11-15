import type { TimeSignatureEvent } from '../song/TimeSignatureEvent'
import type { BarPosition } from './BarPosition'
import type { MeterOverride } from './MeterOverride'
import type { TimeSignature } from './TimeSignature'

const DEFAULT_TIME_SIGNATURE: TimeSignature = { numerator: 4, denominator: 4 }
// Ticks come from float seconds during playback; absorb rounding so a beat start isn't read as the previous beat.
const EPSILON = 1e-6

interface MeterSegment {
  readonly startTick: number
  readonly startBar: number
  readonly timeSignature: TimeSignature
  readonly ticksPerBeat: number
  readonly ticksPerBar: number
}

interface BarMapSource {
  readonly ppq: number
  readonly durationTicks: number
  readonly timeSignatureEvents: readonly TimeSignatureEvent[]
}

/**
 * Bar/beat grid for a song. All seek, loop and pre-roll math goes through this.
 * Bar 1 starts at tick 0, or at the override's barOneStartTick; anything earlier is bar 0.
 * Beat unit is the time signature's denominator (compound meters come later).
 */
export class BarMap {
  readonly barCount: number
  readonly hasBarZero: boolean

  private constructor(
    private readonly segments: readonly MeterSegment[],
    durationTicks: number,
  ) {
    const first = segments[0] as MeterSegment
    this.hasBarZero = first.startTick > 0
    this.barCount = Math.max(1, this.tickToPosition(Math.max(0, durationTicks - 1)).bar)
  }

  static fromSong(song: BarMapSource, override: MeterOverride | null): BarMap {
    const segments =
      override === null
        ? fileSegments(song.ppq, song.timeSignatureEvents)
        : [segment(song.ppq, Math.max(0, override.barOneStartTick), 1, override.timeSignature)]
    return new BarMap(segments, song.durationTicks)
  }

  get firstBar(): number {
    return this.hasBarZero ? 0 : 1
  }

  barStartTick(bar: number): number {
    if (bar === 0 && this.hasBarZero) return 0
    const s = this.segmentForBar(bar)
    return s.startTick + (bar - s.startBar) * s.ticksPerBar
  }

  /** Exclusive end, i.e. the start of the next bar. */
  barEndTick(bar: number): number {
    if (bar === 0 && this.hasBarZero) return this.firstSegment.startTick
    return this.barStartTick(bar + 1)
  }

  timeSignature(bar: number): TimeSignature {
    return this.segmentForBar(bar).timeSignature
  }

  beatsPerBar(bar: number): number {
    return this.segmentForBar(bar).timeSignature.numerator
  }

  ticksPerBeat(bar: number): number {
    return this.segmentForBar(bar).ticksPerBeat
  }

  /**
   * Bar 0 and negative ticks use the first meter's grid extended backward, so a one-beat
   * pickup in 3/4 reads as beat 3. Ticks before 0 (pre-roll) get bar 0 or negative bars.
   */
  tickToPosition(tick: number): BarPosition {
    const s = this.segmentForTick(tick)
    const barOffset = Math.floor((tick - s.startTick) / s.ticksPerBar + EPSILON)
    let bar = s.startBar + barOffset
    const intoBar = tick - (s.startTick + barOffset * s.ticksPerBar)
    const beatFloat = Math.max(0, intoBar / s.ticksPerBeat)
    const beatIndex = Math.floor(beatFloat + EPSILON)
    if (tick >= 0 && bar < 1) bar = 0
    return {
      bar,
      beat: beatIndex + 1,
      beatFraction: Math.max(0, beatFloat - beatIndex),
    }
  }

  /** Ticks of beat starts in [fromTick, toTick), ascending. */
  beatTicksBetween(fromTick: number, toTick: number): number[] {
    const out: number[] = []
    this.segments.forEach((s, i) => {
      const next = this.segments[i + 1]
      // The first segment's grid extends back indefinitely (bar 0, pre-roll); others start at their own tick.
      const lo = i === 0 ? fromTick : Math.max(fromTick, s.startTick)
      const hi = next === undefined ? toTick : Math.min(toTick, next.startTick)
      if (lo >= hi) return
      let k = Math.ceil((lo - s.startTick) / s.ticksPerBeat - EPSILON)
      for (
        let t = s.startTick + k * s.ticksPerBeat;
        t < hi;
        t = s.startTick + ++k * s.ticksPerBeat
      ) {
        out.push(t)
      }
    })
    return out
  }

  private get firstSegment(): MeterSegment {
    return this.segments[0] as MeterSegment
  }

  private segmentForTick(tick: number): MeterSegment {
    return lastWhere(this.segments, (s) => s.startTick <= tick + EPSILON) ?? this.firstSegment
  }

  private segmentForBar(bar: number): MeterSegment {
    return lastWhere(this.segments, (s) => s.startBar <= bar) ?? this.firstSegment
  }
}

function segment(
  ppq: number,
  startTick: number,
  startBar: number,
  timeSignature: TimeSignature,
): MeterSegment {
  const ticksPerBeat = (ppq * 4) / timeSignature.denominator
  return {
    startTick,
    startBar,
    timeSignature,
    ticksPerBeat,
    ticksPerBar: ticksPerBeat * timeSignature.numerator,
  }
}

function fileSegments(ppq: number, events: readonly TimeSignatureEvent[]): MeterSegment[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick)
  // Several events on one tick: the last one wins.
  const byTick = new Map<number, TimeSignature>()
  for (const e of sorted) {
    byTick.set(Math.max(0, e.tick), { numerator: e.numerator, denominator: e.denominator })
  }
  if (!byTick.has(0)) byTick.set(0, DEFAULT_TIME_SIGNATURE)

  const segments: MeterSegment[] = []
  for (const [tick, ts] of [...byTick].sort((a, b) => a[0] - b[0])) {
    const prev = segments[segments.length - 1]
    if (prev === undefined) {
      segments.push(segment(ppq, tick, 1, ts))
      continue
    }
    // Files often repeat the current meter (e.g. at a section start); that must not start a bar.
    if (
      prev.timeSignature.numerator === ts.numerator &&
      prev.timeSignature.denominator === ts.denominator
    ) {
      continue
    }
    // A change mid-bar cuts that bar short; the new meter starts a fresh bar at the event.
    const bars = Math.ceil((tick - prev.startTick) / prev.ticksPerBar - EPSILON)
    segments.push(segment(ppq, tick, prev.startBar + bars, ts))
  }
  return segments
}

function lastWhere<T>(items: readonly T[], predicate: (item: T) => boolean): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i] as T
    if (predicate(item)) return item
  }
  return undefined
}
