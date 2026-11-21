import type { LabelState } from '../model/LabelState'

/** One note label in the overlap pass, for tests (`?stats=1`). */
export interface LabelSnapshot {
  readonly id: string
  readonly state: LabelState
  /** Rendered visibility, 0–1. */
  readonly shown: number
  readonly slot: number
}
