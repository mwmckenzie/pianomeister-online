import type { HandLetter } from './HandLetter'
import type { RawNote } from './RawNote'

/** A parameter of a split method; the Review page builds its control from this. */
export interface SplitParam {
  readonly key: string
  readonly label: string
  readonly type: 'number' | 'note'
  readonly default: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly help?: string
}

export interface SplitContext {
  readonly ticksPerBeat: number
  /** Ticks to seconds through the file's tempo map. */
  readonly seconds: (tick: number) => number
}

export interface SplitResult {
  readonly hands: ReadonlyMap<string, HandLetter>
  /** Ids of the notes the method isn't sure about. */
  readonly uncertain: ReadonlySet<string>
}

/** Assigns every note of the voices being split to a hand (HD brief §6). */
export interface SplitAlgorithm {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly params: readonly SplitParam[]
  run(
    notes: readonly RawNote[],
    params: Readonly<Record<string, number>>,
    context: SplitContext,
  ): SplitResult
}
