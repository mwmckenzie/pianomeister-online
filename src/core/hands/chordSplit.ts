import type { HandLetter } from './HandLetter'
import type { RawNote } from './RawNote'
import type { SplitAlgorithm } from './SplitAlgorithm'

const mean = (notes: readonly RawNote[]) => notes.reduce((sum, n) => sum + n.midi, 0) / notes.length
const pitches = (notes: readonly RawNote[]) => notes.map((n) => n.midi)

/** HD brief §6.2: cuts each chord where it best fits two hands, chord by chord (greedy). */
export const chordSplit: SplitAlgorithm = {
  id: 'chord',
  name: 'Chord-aware',
  description:
    'Groups notes that start together, then cuts each group where it best fits two hands: each hand stays within its reach, holds at most five notes, and stays near where it was just playing.',
  params: [
    {
      key: 'reach',
      label: 'Hand reach (semitones)',
      type: 'number',
      default: 14,
      min: 7,
      max: 24,
      step: 1,
    },
    {
      key: 'cluster',
      label: 'Chord tolerance (beats)',
      type: 'number',
      default: 0.0625,
      min: 0,
      max: 1,
      step: 0.03125,
      help: 'Notes starting within this time count as one chord',
    },
    {
      key: 'inertia',
      label: 'Position weight',
      type: 'number',
      default: 1,
      min: 0,
      max: 5,
      step: 0.1,
      help: 'How strongly a hand prefers to stay put',
    },
    {
      key: 'startR',
      label: 'Right hand start',
      type: 'note',
      default: 67,
      min: 0,
      max: 127,
      step: 1,
    },
    {
      key: 'startL',
      label: 'Left hand start',
      type: 'note',
      default: 48,
      min: 0,
      max: 127,
      step: 1,
    },
  ],
  run(notes, params, context) {
    const { reach = 14, cluster: tolerance = 0.0625, inertia = 1 } = params
    const tolTicks = tolerance * context.ticksPerBeat
    const sorted = [...notes].sort((a, b) => a.startTick - b.startTick || a.midi - b.midi)
    const hands = new Map<string, HandLetter>()
    let posR = params.startR ?? 67
    let posL = params.startL ?? 48
    let heldR: RawNote[] = []
    let heldL: RawNote[] = []

    let i = 0
    while (i < sorted.length) {
      const start = (sorted[i] as RawNote).startTick
      const chord: RawNote[] = []
      while ((sorted[i]?.startTick ?? Infinity) - start <= tolTicks) {
        chord.push(sorted[i++] as RawNote)
      }
      chord.sort((a, b) => a.midi - b.midi)
      heldR = heldR.filter((n) => n.endTick > start + tolTicks)
      heldL = heldL.filter((n) => n.endTick > start + tolTicks)

      const handCost = (fresh: readonly RawNote[], held: readonly RawNote[], pos: number) => {
        const all = pitches([...fresh, ...held])
        if (all.length === 0) return 0
        let cost = 4 * Math.max(0, Math.max(...all) - Math.min(...all) - reach)
        cost += 10 * Math.max(0, all.length - 5)
        if (fresh.length > 0) cost += inertia * Math.abs(mean(fresh) - pos) * 0.5
        return cost
      }
      const cutCost = (k: number) => {
        const left = chord.slice(0, k)
        const right = chord.slice(k)
        const crossed =
          Math.max(-Infinity, ...pitches(left), ...pitches(heldL)) >
          Math.min(Infinity, ...pitches(right), ...pitches(heldR))
        return handCost(left, heldL, posL) + handCost(right, heldR, posR) + (crossed ? 6 : 0)
      }

      let cut = 0
      let best = Infinity
      for (let k = 0; k <= chord.length; k++) {
        const cost = cutCost(k)
        if (cost < best - 1e-9) {
          best = cost
          cut = k
        }
      }
      const left = chord.slice(0, cut)
      const right = chord.slice(cut)
      for (const n of left) hands.set(n.id, 'L')
      for (const n of right) hands.set(n.id, 'R')
      heldL.push(...left)
      heldR.push(...right)
      if (left.length > 0) posL = posL * 0.5 + mean(left) * 0.5
      if (right.length > 0) posR = posR * 0.5 + mean(right) * 0.5
      // The two positions never collapse onto each other.
      if (posR - posL < 5) {
        const mid = (posR + posL) / 2
        posR = mid + 2.5
        posL = mid - 2.5
      }
    }
    return { hands, uncertain: new Set() }
  },
}
