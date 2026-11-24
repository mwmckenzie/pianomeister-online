import { META_TIME_SIGNATURE, ticksPerBeat, type MidiFile } from '../midi/MidiFile'
import { readMidiFile } from '../midi/readMidiFile'
import type { TimeSignatureEvent } from '../song/TimeSignatureEvent'
import { BarMap } from '../timing/BarMap'
import { computeVoiceStats } from './computeVoiceStats'
import { extractNotes } from './extractNotes'
import { fileSplitContext } from './fileSplitContext'
import type { HandLetter } from './HandLetter'
import type { RawNote } from './RawNote'
import type { SplitAlgorithm } from './SplitAlgorithm'
import type { WrongRun } from './WrongRun'

export interface BenchmarkScore {
  readonly algorithm: string
  readonly correct: number
  /** The longest run of wrong notes by count, and the longest by time (often the same). */
  readonly longestRun: WrongRun | null
  readonly longestTime: WrongRun | null
  /** Notes marked uncertain, and those of them that are wrong. */
  readonly uncertain: number
  readonly uncertainWrong: number
  readonly ms: number
}

export interface BenchmarkResult {
  readonly notes: number
  /** Notes never released: they sound to their track's end. */
  readonly unreleased: number
  readonly scores: readonly BenchmarkScore[]
}

/**
 * HD brief criterion 12: merges the hands of a file whose tracks are named right/left (or
 * rechts/links), splits them again with each method and scores it against the tracks. Null when
 * the file doesn't have both.
 */
export function benchmarkSplit(
  bytes: Uint8Array,
  algorithms: readonly SplitAlgorithm[],
  overrides: Readonly<Record<string, Readonly<Record<string, number>>>>,
  now: () => number,
): BenchmarkResult | null {
  const file = readMidiFile(bytes)
  const all = extractNotes(file)
  const hands = new Map<number, HandLetter>()
  for (const { track, trackName } of computeVoiceStats(file, all)) {
    if (/right|rechts/i.test(trackName)) hands.set(track, 'R')
    else if (/left|links/i.test(trackName)) hands.set(track, 'L')
  }
  const notes = all.filter((n) => hands.has(n.track))
  if (new Set(hands.values()).size < 2) return null
  const context = fileSplitContext(file)
  const bars = BarMap.fromSong(
    {
      ppq: ticksPerBeat(file),
      durationTicks: notes.reduce((end, n) => Math.max(end, n.endTick), 0),
      timeSignatureEvents: timeSignatures(file),
    },
    null,
  )
  const scores = algorithms.map((a): BenchmarkScore => {
    const started = now()
    const result = a.run(notes, overrides[a.id] ?? {}, context)
    const ms = now() - started
    let uncertain = 0
    let uncertainWrong = 0
    const runs: RawNote[][] = []
    let run: RawNote[] | null = null
    for (const n of notes) {
      const wrong = result.hands.get(n.id) !== hands.get(n.track)
      if (result.uncertain.has(n.id)) {
        uncertain++
        if (wrong) uncertainWrong++
      }
      if (!wrong) run = null
      else if (run === null) runs.push((run = [n]))
      else run.push(n)
    }
    const seconds = (r: readonly RawNote[]) =>
      context.seconds(r[r.length - 1]?.startTick ?? 0) - context.seconds(r[0]?.startTick ?? 0)
    /** Of equals the first. */
    const longest = (size: (r: readonly RawNote[]) => number): WrongRun | null => {
      const r = runs.reduce<readonly RawNote[]>(
        (best, next) => (best.length === 0 || size(next) > size(best) ? next : best),
        [],
      )
      const first = r[0]
      if (first === undefined) return null
      const rightGivenLeft = r.filter((n) => hands.get(n.track) === 'R').length
      return {
        notes: r.length,
        seconds: seconds(r),
        startBar: bars.tickToPosition(first.startTick).bar,
        startSeconds: context.seconds(first.startTick),
        rightGivenLeft,
        leftGivenRight: r.length - rightGivenLeft,
      }
    }
    return {
      algorithm: a.id,
      correct: notes.length - runs.reduce((sum, r) => sum + r.length, 0),
      longestRun: longest((r) => r.length),
      longestTime: longest(seconds),
      uncertain,
      uncertainWrong,
      ms,
    }
  })
  return { notes: notes.length, unreleased: all.filter((n) => n.offIndex < 0).length, scores }
}

function timeSignatures(file: MidiFile): TimeSignatureEvent[] {
  return file.tracks.flatMap((track) =>
    track.events.flatMap((e) => {
      if (e.kind !== 'meta' || e.metaType !== META_TIME_SIGNATURE) return []
      const [numerator = 0, power = 2] = e.data
      return numerator > 0 ? [{ tick: e.tick, numerator, denominator: 2 ** power }] : []
    }),
  )
}
