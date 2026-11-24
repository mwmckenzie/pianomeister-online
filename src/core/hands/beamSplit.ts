import { clusterByTime, type NoteCluster } from './clusterByTime'
import type { HandLetter } from './HandLetter'
import type { RawNote } from './RawNote'
import type { SplitAlgorithm } from './SplitAlgorithm'

/**
 * A note is uncertain when fewer than UNCERTAIN_AGREEMENT of the readings kept
 * UNCERTAIN_LAG_CHORDS chords after it give it the winner's hand. The lag, because the final
 * beam's readings share almost all their history and differ in the last few bars only; 8 was
 * measured on three songs: docs/milestones/m10-5-plan.md §8, Q2. A song's last
 * UNCERTAIN_LAG_CHORDS chords are never marked.
 */
export const UNCERTAIN_LAG_CHORDS = 8
export const UNCERTAIN_AGREEMENT = 0.75

interface Trail {
  readonly previous: Trail | null
  readonly cluster: number
  /** The chord's lowest `cut` notes are the left hand's. */
  readonly cut: number
}

interface Reading {
  readonly cost: number
  readonly posR: number
  readonly posL: number
  readonly heldR: readonly RawNote[]
  readonly heldL: readonly RawNote[]
  readonly trail: Trail | null
}

const mean = (notes: readonly RawNote[]) => notes.reduce((sum, n) => sum + n.midi, 0) / notes.length

/**
 * Phrase look-ahead (HD brief §6.1): a beam search keeping the cheapest partial readings of the
 * piece and committing only at the end, so one wrong chord can't swap the hands for bars. It
 * weighs reach (notes held longer than `holdSecs` count less: the pedal can take over), more
 * than five notes in a hand, movement, register and crossing hands.
 */
export const beamSplit: SplitAlgorithm = {
  id: 'beam',
  name: 'Phrase look-ahead',
  description:
    'Keeps several possible readings of the music at once and picks the cheapest over the whole piece, so one wrong guess cannot flip the hands for bars. Prefers low notes left and high notes right, keeps hands from crossing, and groups slightly spread chords the way a human plays them.',
  params: [
    {
      key: 'reach',
      label: 'Hand reach (semitones)',
      type: 'number',
      default: 12,
      min: 7,
      max: 24,
      step: 1,
    },
    {
      key: 'center',
      label: 'Register centre',
      type: 'note',
      default: 60,
      min: 24,
      max: 96,
      step: 1,
      help: 'Pitch where neither hand is preferred',
    },
    {
      key: 'prior',
      label: 'Register weight',
      type: 'number',
      default: 0.1,
      min: 0,
      max: 3,
      step: 0.05,
      help: 'How strongly low notes prefer the left hand and high notes the right',
    },
    {
      key: 'inertia',
      label: 'Position weight',
      type: 'number',
      default: 1,
      min: 0,
      max: 5,
      step: 0.1,
    },
    {
      key: 'chordMs',
      label: 'Chord spread (ms)',
      type: 'number',
      default: 30,
      min: 0,
      max: 300,
      step: 5,
      help: 'Notes starting this close together count as one chord',
    },
    {
      key: 'holdSecs',
      label: 'Held-note limit (s)',
      type: 'number',
      default: 0.8,
      min: 0.1,
      max: 10,
      step: 0.1,
      help: 'Held longer than this, a note limits its hand less',
    },
    {
      key: 'beam',
      label: 'Readings kept',
      type: 'number',
      default: 32,
      min: 1,
      max: 256,
      step: 1,
      help: 'More is slower but more thorough',
    },
  ],
  run(notes, params, { seconds }) {
    const {
      reach = 12,
      center = 60,
      prior = 0.1,
      inertia = 1,
      chordMs = 30,
      holdSecs = 0.8,
      beam: beamSize = 32,
    } = params
    const clusters = clusterByTime(notes, chordMs / 1000, seconds)
    const starts = new Map(notes.map((n) => [n.id, seconds(n.startTick)]))
    const ends = new Map(notes.map((n) => [n.id, seconds(n.endTick)]))
    const startOf = (n: RawNote) => starts.get(n.id) ?? 0
    const endOf = (n: RawNote) => ends.get(n.id) ?? 0

    const over = (ns: readonly RawNote[]): number => {
      let low = Infinity
      let high = -Infinity
      for (const n of ns) {
        if (n.midi < low) low = n.midi
        if (n.midi > high) high = n.midi
      }
      return Math.max(0, high - low - reach)
    }
    const handCost = (
      fresh: readonly RawNote[],
      held: readonly RawNote[],
      recent: readonly RawNote[],
      pos: number,
      hand: HandLetter,
    ): number => {
      if (fresh.length === 0 && held.length === 0) return 0
      const near = [...fresh, ...recent]
      const overNear = over(near)
      let cost = 4 * overNear + Math.max(0, over([...fresh, ...held]) - overNear)
      if (near.length > 5) cost += 10 * (near.length - 5)
      if (fresh.length > 0) {
        cost += inertia * 0.5 * Math.abs(mean(fresh) - pos)
        for (const n of fresh) {
          cost += prior * Math.max(0, hand === 'R' ? center - n.midi : n.midi - center)
        }
      }
      return cost
    }

    let beam: Reading[] = [
      { cost: 0, posR: center + 7, posL: center - 12, heldR: [], heldL: [], trail: null },
    ]
    /** The kept readings' trails after each chord, for the uncertain notes. */
    const kept: (readonly (Trail | null)[])[] = []

    clusters.forEach((cluster, index) => {
      const now = cluster.time
      const next = new Map<string, Reading>()
      for (const reading of beam) {
        const heldR = reading.heldR.filter((n) => endOf(n) > now + 0.01)
        const heldL = reading.heldL.filter((n) => endOf(n) > now + 0.01)
        const recentR = heldR.filter((n) => now - startOf(n) < holdSecs)
        const recentL = heldL.filter((n) => now - startOf(n) < holdSecs)
        for (let cut = 0; cut <= cluster.notes.length; cut++) {
          const left = cluster.notes.slice(0, cut)
          const right = cluster.notes.slice(cut)
          let cost =
            reading.cost +
            handCost(left, heldL, recentL, reading.posL, 'L') +
            handCost(right, heldR, recentR, reading.posR, 'R')
          const leftTop = [...left, ...recentL].reduce((m, n) => Math.max(m, n.midi), -Infinity)
          const rightLow = [...right, ...recentR].reduce((m, n) => Math.min(m, n.midi), Infinity)
          if (leftTop > rightLow) cost += 12 + 2 * (leftTop - rightLow)

          let posL = left.length > 0 ? reading.posL * 0.65 + mean(left) * 0.35 : reading.posL
          let posR = right.length > 0 ? reading.posR * 0.65 + mean(right) * 0.35 : reading.posR
          if (posR - posL < 3) {
            const mid = (posR + posL) / 2
            posR = mid + 1.5
            posL = mid - 1.5
          }
          const candidate: Reading = {
            cost,
            posR,
            posL,
            heldR: right.length > 0 ? [...heldR, ...right] : heldR,
            heldL: left.length > 0 ? [...heldL, ...left] : heldL,
            trail: { previous: reading.trail, cluster: index, cut },
          }
          // Readings that reached the same situation merge; the cheaper one stays.
          const key = `${Math.round(posR)}|${Math.round(posL)}|${ids(candidate.heldR)}|${ids(candidate.heldL)}`
          const known = next.get(key)
          if (known === undefined || known.cost > cost) next.set(key, candidate)
        }
      }
      beam = [...next.values()]
        .sort((a, b) => a.cost - b.cost)
        .slice(0, Math.max(1, Math.round(beamSize)))
      kept.push(beam.map((r) => r.trail))
    })

    const cuts: number[] = []
    for (let t = beam[0]?.trail ?? null; t !== null; t = t.previous) cuts[t.cluster] = t.cut
    const hands = new Map<string, HandLetter>()
    clusters.forEach((cluster, index) => {
      cluster.notes.forEach((n, i) => hands.set(n.id, i < (cuts[index] ?? 0) ? 'L' : 'R'))
    })
    return { hands, uncertain: uncertainNotes(clusters, cuts, kept) }
  },
}

const ids = (notes: readonly RawNote[]) => notes.map((n) => n.id).join(',')

function uncertainNotes(
  clusters: readonly NoteCluster[],
  cuts: readonly number[],
  kept: readonly (readonly (Trail | null)[])[],
): Set<string> {
  const out = new Set<string>()
  clusters.forEach((cluster, index) => {
    // The last chords have no such beam, and a younger one marks even clean endings.
    const later = kept[index + UNCERTAIN_LAG_CHORDS]
    if (later === undefined) return
    const others = later.map((trail) => {
      let t = trail
      while (t !== null && t.cluster > index) t = t.previous
      return t?.cut ?? 0
    })
    cluster.notes.forEach((n, i) => {
      const left = i < (cuts[index] ?? 0)
      const agreeing = others.filter((cut) => i < cut === left).length
      if (agreeing / others.length < UNCERTAIN_AGREEMENT) out.add(n.id)
    })
  })
  return out
}
