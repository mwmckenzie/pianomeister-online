import type { TempoEvent } from '../song/TempoEvent'

const DEFAULT_MICROS_PER_QUARTER = 500_000 // 120 BPM, the MIDI default

interface Segment {
  readonly tick: number
  readonly seconds: number
  readonly secondsPerTick: number
  readonly microsPerQuarter: number
}

/** Converts between ticks and seconds (at 100% tempo) across tempo changes. */
export class TempoMap {
  private readonly segments: readonly Segment[]

  constructor(
    readonly ppq: number,
    events: readonly TempoEvent[],
  ) {
    if (!(ppq > 0)) throw new RangeError(`ppq must be positive, got ${ppq}`)
    const byTick = new Map<number, number>()
    // Later events on the same tick win, matching how a sequencer would apply them.
    for (const e of [...events].sort((a, b) => a.tick - b.tick)) {
      byTick.set(Math.max(0, e.tick), e.microsPerQuarter)
    }
    if (!byTick.has(0)) byTick.set(0, DEFAULT_MICROS_PER_QUARTER)

    const segments: Segment[] = []
    for (const [tick, microsPerQuarter] of [...byTick].sort((a, b) => a[0] - b[0])) {
      const prev = segments[segments.length - 1]
      if (prev !== undefined && prev.microsPerQuarter === microsPerQuarter) continue
      const seconds =
        prev === undefined ? 0 : prev.seconds + (tick - prev.tick) * prev.secondsPerTick
      segments.push({ tick, seconds, secondsPerTick: microsPerQuarter / 1e6 / ppq, microsPerQuarter })
    }
    this.segments = segments
  }

  /** Negative ticks extrapolate with the first tempo (used for pre-roll before the song starts). */
  tickToSeconds(tick: number): number {
    const s = this.segmentAt((seg) => seg.tick <= tick)
    return s.seconds + (tick - s.tick) * s.secondsPerTick
  }

  secondsToTick(seconds: number): number {
    const s = this.segmentAt((seg) => seg.seconds <= seconds)
    return s.tick + (seconds - s.seconds) / s.secondsPerTick
  }

  microsPerQuarterAt(tick: number): number {
    return this.segmentAt((seg) => seg.tick <= tick).microsPerQuarter
  }

  secondsPerQuarterAt(tick: number): number {
    return this.microsPerQuarterAt(tick) / 1e6
  }

  bpmAt(tick: number): number {
    return 60e6 / this.microsPerQuarterAt(tick)
  }

  /** Last segment satisfying `isAtOrBefore` (monotone over segments), else the first one. */
  private segmentAt(isAtOrBefore: (seg: Segment) => boolean): Segment {
    let lo = 0
    let hi = this.segments.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (isAtOrBefore(this.segments[mid] as Segment)) lo = mid
      else hi = mid - 1
    }
    return this.segments[lo] as Segment
  }
}
