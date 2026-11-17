import type { TempoEvent } from '../song/TempoEvent'

const DEFAULT_MICROS_PER_QUARTER = 500_000 // 120 BPM, the MIDI default

/** Share of song time cut from each end, so a short ritardando or pickup doesn't set the range. */
const TAIL = 0.05

/**
 * Tempo range (bpm at 100%) over the song's time, from tick 0 to `endTick`: the 5th and 95th
 * percentiles of the tempo, weighted by how many seconds each tempo plays (brief decision 56).
 * Events are read the way TempoMap reads them: 120 bpm until the first event if none is at tick
 * 0, the last of several events on one tick wins, and events at or after the end don't count.
 * A constant tempo gives one value; an empty song gives its start tempo.
 */
export function tempoRange(
  events: readonly TempoEvent[],
  endTick: number,
  ppq: number,
): { readonly min: number; readonly max: number } {
  const byTick = new Map<number, number>()
  for (const e of [...events].sort((a, b) => a.tick - b.tick)) {
    byTick.set(Math.max(0, e.tick), e.microsPerQuarter)
  }
  if (!byTick.has(0)) byTick.set(0, DEFAULT_MICROS_PER_QUARTER)
  const ticks = [...byTick.keys()].sort((a, b) => a - b)

  // Seconds played at each tempo.
  const spans: { bpm: number; seconds: number }[] = []
  ticks.forEach((tick, i) => {
    const micros = byTick.get(tick) as number
    const end = Math.min(ticks[i + 1] ?? endTick, endTick)
    if (end > tick)
      spans.push({ bpm: 60e6 / micros, seconds: ((end - tick) / ppq) * micros * 1e-6 })
  })
  if (spans.length === 0) {
    const bpm = 60e6 / (byTick.get(0) as number)
    return { min: bpm, max: bpm }
  }

  spans.sort((a, b) => a.bpm - b.bpm)
  const total = spans.reduce((sum, s) => sum + s.seconds, 0)
  return { min: percentile(spans, TAIL * total), max: percentile(spans, (1 - TAIL) * total) }
}

/** The tempo playing at `seconds` into the spans sorted by tempo. */
function percentile(spans: readonly { bpm: number; seconds: number }[], seconds: number): number {
  // Relative tolerance: a tempo covering exactly the cut-off share still counts as the tail.
  const tolerance = 1e-9 * Math.max(1, seconds)
  let elapsed = 0
  for (const s of spans) {
    elapsed += s.seconds
    if (elapsed > seconds + tolerance) return s.bpm
  }
  return (spans[spans.length - 1] as { bpm: number }).bpm
}
