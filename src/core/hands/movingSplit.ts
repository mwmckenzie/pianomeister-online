import type { HandLetter } from './HandLetter'
import type { SplitAlgorithm } from './SplitAlgorithm'

/** HD brief §6.3: the split point is the middle of the largest gap in a window around each note. */
export const movingSplit: SplitAlgorithm = {
  id: 'moving',
  name: 'Moving split point',
  description:
    'The split point follows the music: for each note it is the midpoint between the high and low registers played in a window around it. Handles pieces that move up and down the keyboard.',
  params: [
    {
      key: 'window',
      label: 'Window (beats)',
      type: 'number',
      default: 4,
      min: 0.5,
      max: 32,
      step: 0.5,
    },
    {
      key: 'fallback',
      label: 'Fallback split',
      type: 'note',
      default: 60,
      min: 0,
      max: 127,
      step: 1,
      help: 'Used when the window holds one register only',
    },
    {
      key: 'minGap',
      label: 'Min register gap',
      type: 'number',
      default: 7,
      min: 0,
      max: 36,
      step: 1,
      help: 'Semitones between registers before trusting the window',
    },
  ],
  run(notes, params, context) {
    const { window = 4, fallback = 60, minGap = 7 } = params
    const half = (window * context.ticksPerBeat) / 2
    const sorted = [...notes].sort((a, b) => a.startTick - b.startTick)
    const hands = new Map<string, HandLetter>()
    let from = 0
    let to = 0
    for (const n of sorted) {
      while ((sorted[from]?.startTick ?? Infinity) < n.startTick - half) from++
      while ((sorted[to]?.startTick ?? Infinity) <= n.startTick + half) to++
      const pitches = sorted
        .slice(from, to)
        .map((x) => x.midi)
        .sort((a, b) => a - b)
      let bestGap = 0
      let middle = fallback
      for (let i = 1; i < pitches.length; i++) {
        const low = pitches[i - 1] as number
        const high = pitches[i] as number
        if (high - low > bestGap) {
          bestGap = high - low
          middle = (low + high) / 2
        }
      }
      const split = bestGap > 0 && bestGap >= minGap ? middle : fallback
      hands.set(n.id, n.midi >= split ? 'R' : 'L')
    }
    return { hands, uncertain: new Set() }
  },
}
