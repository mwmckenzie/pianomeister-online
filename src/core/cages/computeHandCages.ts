import type { Hand } from '../hands/Hand'
import type { Note } from '../song/Note'
import type { BarMap } from '../timing/BarMap'
import type { HandCage } from './HandCage'
import type { HandCages } from './HandCages'
import { MIN_CAGE_SPREAD } from './MIN_CAGE_SPREAD'
import { PIANO_HIGH } from './PIANO_HIGH'
import { PIANO_LOW } from './PIANO_LOW'

const HANDS: readonly Hand[] = ['right', 'left']

/**
 * The hand cages of a song (milestone 10, ported from the Unity app with its gaps fixed): per
 * hand and bar, the lowest to highest key of the hand's notes **sounding** in the bar (written
 * ends; the pedal is ignored), widened to MIN_CAGE_SPREAD toward where the hand came from. A bar
 * without notes holds the previous range (carried); nothing before the hand's first note or
 * after its last. Pure: the hand comes only from `handOf`, never from channels.
 */
export function computeHandCages<N extends Note>(
  notes: readonly N[],
  barMap: BarMap,
  handOf: (note: N) => Hand | null,
): HandCages {
  const byHand: Record<Hand, N[]> = { right: [], left: [] }
  for (const note of notes) {
    const hand = handOf(note)
    if (hand !== null) byHand[hand].push(note)
  }
  return { right: cagesOf(byHand.right, barMap), left: cagesOf(byHand.left, barMap) }
}

/** A note's end for "sounding": zero-length notes last one tick. */
const endOf = (note: Note) => Math.max(note.endTick, note.startTick + 1)

function cagesOf(notes: readonly Note[], barMap: BarMap): HandCage[] {
  if (notes.length === 0) return []
  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick)
  const lastEnd = Math.max(...sorted.map(endOf))
  const lastBar = Math.max(barMap.barCount, barMap.tickToPosition(lastEnd - 1).bar)
  const out: HandCage[] = []
  let prev = null as HandCage | null
  let next = 0
  let active: Note[] = []
  for (let bar = barMap.firstBar; bar <= lastBar; bar++) {
    const start = barMap.barStartTick(bar)
    const end = barMap.barEndTick(bar)
    // After the hand's last note: no more cages (trailing rests don't carry).
    if (start >= lastEnd) break
    while (next < sorted.length && (sorted[next] as Note).startTick < end) {
      active.push(sorted[next] as Note)
      next++
    }
    active = active.filter((n) => endOf(n) > start)
    let cage: HandCage | null = null
    if (active.length > 0) {
      const pitches = active.map((n) => clampKey(n.midi))
      const [low, high] = widen(Math.min(...pitches), Math.max(...pitches), prev)
      cage = { barIndex: bar, startTick: start, endTick: end, low, high, carried: false }
    } else if (prev !== null) {
      const held: HandCage = prev
      cage = {
        barIndex: bar,
        startTick: start,
        endTick: end,
        low: held.low,
        high: held.high,
        carried: true,
      }
    }
    if (cage !== null) {
      out.push(cage)
      prev = cage
    }
  }
  return out
}

const clampKey = (midi: number) => Math.min(PIANO_HIGH, Math.max(PIANO_LOW, midi))
const mean = (low: number, high: number) => (low + high) / 2

/**
 * Widens a range narrower than MIN_CAGE_SPREAD one semitone at a time: up when the hand came
 * down (the previous cage sits higher), down when it came up, else centred (high first, then
 * alternating). A side at the keyboard's end widens the other side instead.
 */
function widen(low: number, high: number, prev: HandCage | null): [number, number] {
  const here = mean(low, high)
  const there = prev === null ? here : mean(prev.low, prev.high)
  let raiseNext = true
  while (high - low < MIN_CAGE_SPREAD) {
    let raise: boolean
    if (there > here) raise = true
    else if (there < here) raise = false
    else {
      raise = raiseNext
      raiseNext = !raiseNext
    }
    if (raise && high >= PIANO_HIGH) raise = false
    else if (!raise && low <= PIANO_LOW) raise = true
    if (raise) high++
    else low--
  }
  return [low, high]
}
