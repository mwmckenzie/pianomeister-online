import type { SplitAlgorithm } from './SplitAlgorithm'

/** HD brief §6.4. */
export const fixedSplit: SplitAlgorithm = {
  id: 'fixed',
  name: 'Fixed split point',
  description:
    'Every note at or above the split pitch goes to the right hand. Simple and predictable.',
  params: [
    {
      key: 'split',
      label: 'Split at',
      type: 'note',
      default: 60,
      min: 0,
      max: 127,
      step: 1,
      help: 'Notes at or above go right',
    },
  ],
  run(notes, params) {
    const split = params.split ?? 60
    return {
      hands: new Map(notes.map((n) => [n.id, n.midi >= split ? 'R' : 'L'])),
      uncertain: new Set(),
    }
  },
}
