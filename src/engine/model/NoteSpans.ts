/** Instances [first, first + count) of a layer. */
export interface InstanceRange {
  readonly first: number
  readonly count: number
}

/** Where a range stays the same: windows with `from` in [from, fromEnd) and `to` in (toStart, to]. */
export interface RangeBounds {
  readonly from: number
  readonly fromEnd: number
  readonly toStart: number
  readonly to: number
}

/** The song ticks a layer may show: notes sounding after `from` and starting before `to`. */
export interface TickWindow {
  readonly from: number
  readonly to: number
  /** Notes starting before this are left out (a loop repeat's iteration). */
  readonly startFrom?: number
}

/**
 * Instances per bucket: ranges start and end on bucket edges, one whole bucket beyond what the
 * window asks for, so a note is drawn (fully faded) well before it can be seen.
 */
export const BUCKET = 8

/**
 * Finds a layer's notes in a tick window (milestone 11: only those are drawn). The notes are
 * sorted by start, ascending or (heads, labels) descending; the running maximum of their ends
 * keeps a long note in the range until it has ended, however many notes started after it.
 */
export class NoteSpans {
  private readonly starts: Float64Array
  private readonly maxEnds: Float64Array

  constructor(
    notes: readonly { readonly startTick: number; readonly endTick: number }[],
    private readonly descending: boolean,
  ) {
    const n = notes.length
    this.starts = new Float64Array(n)
    this.maxEnds = new Float64Array(n)
    let max = -Infinity
    for (let i = 0; i < n; i++) {
      const note = notes[descending ? n - 1 - i : i]
      if (note === undefined) continue
      this.starts[i] = note.startTick
      max = Math.max(max, note.endTick)
      this.maxEnds[i] = max
    }
  }

  /** Windows (without `startFrom`) that have the same range as this one. */
  bounds(window: TickWindow): RangeBounds {
    const lo = search(this.maxEnds, (end) => end > window.from)
    const hi = firstStart(this.starts, window.to)
    return {
      from: lo === 0 ? -Infinity : (this.maxEnds[lo - 1] as number),
      fromEnd: this.maxEnds[lo] ?? Infinity,
      toStart: hi === 0 ? -Infinity : (this.starts[hi - 1] as number),
      to: this.starts[hi] ?? Infinity,
    }
  }

  /** Every instance the window may show, in the layer's own order, padded to buckets. */
  range(window: TickWindow): InstanceRange {
    const n = this.starts.length
    const lo = Math.max(
      search(this.maxEnds, (end) => end > window.from),
      window.startFrom === undefined ? 0 : firstStart(this.starts, window.startFrom),
    )
    const hi = firstStart(this.starts, window.to)
    if (hi <= lo) return { first: 0, count: 0 }
    const from = this.descending ? n - hi : lo
    const to = this.descending ? n - lo : hi
    const first = Math.max(0, (Math.floor(from / BUCKET) - 1) * BUCKET)
    const end = Math.min(n, (Math.ceil(to / BUCKET) + 1) * BUCKET)
    return { first, count: end - first }
  }
}

function firstStart(starts: Float64Array, tick: number): number {
  return search(starts, (start) => start >= tick)
}

/** First index of the ascending `values` where `test` holds. */
function search(values: Float64Array, test: (v: number) => boolean): number {
  let lo = 0
  let hi = values.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (test(values[mid] as number)) hi = mid
    else lo = mid + 1
  }
  return lo
}
