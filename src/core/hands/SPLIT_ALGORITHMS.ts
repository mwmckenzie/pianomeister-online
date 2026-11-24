import { beamSplit } from './beamSplit'
import { chordSplit } from './chordSplit'
import { fixedSplit } from './fixedSplit'
import { movingSplit } from './movingSplit'
import type { SplitAlgorithm } from './SplitAlgorithm'

/** The first is the default (and the recommended one). */
export const SPLIT_ALGORITHMS = [
  beamSplit,
  chordSplit,
  movingSplit,
  fixedSplit,
] as const satisfies readonly SplitAlgorithm[]

/** The method with this id, or the default for one this version doesn't know. */
export function splitAlgorithm(id: string): SplitAlgorithm {
  return SPLIT_ALGORITHMS.find((a) => a.id === id) ?? beamSplit
}
