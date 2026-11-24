import { readMidiFile } from '../midi/readMidiFile'
import { computeVoiceStats } from './computeVoiceStats'
import { extractNotes } from './extractNotes'
import { fileSplitContext } from './fileSplitContext'
import type { HandLetter } from './HandLetter'
import type { SplitAlgorithm } from './SplitAlgorithm'

export interface BenchmarkScore {
  readonly algorithm: string
  readonly correct: number
  /** The longest run of consecutive wrong notes, and the longest in seconds. */
  readonly wrongRun: number
  readonly wrongSeconds: number
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
  const scores = algorithms.map((a): BenchmarkScore => {
    const started = now()
    const result = a.run(notes, overrides[a.id] ?? {}, context)
    const ms = now() - started
    let correct = 0
    let run = 0
    let runStart = 0
    let wrongRun = 0
    let wrongSeconds = 0
    for (const n of notes) {
      if (result.hands.get(n.id) === hands.get(n.track)) {
        correct++
        run = 0
        continue
      }
      const at = context.seconds(n.startTick)
      if (run === 0) runStart = at
      run++
      wrongRun = Math.max(wrongRun, run)
      wrongSeconds = Math.max(wrongSeconds, at - runStart)
    }
    return { algorithm: a.id, correct, wrongRun, wrongSeconds, ms }
  })
  return { notes: notes.length, unreleased: all.filter((n) => n.offIndex < 0).length, scores }
}
