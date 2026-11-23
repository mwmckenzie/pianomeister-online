/**
 * The order a playlist plays in (milestone 9.5 C): entry indices (missing songs left out) and the
 * position of the current one. Shuffled, it's a permutation with no repeats until every entry
 * has played.
 */
export interface PlayOrder {
  readonly order: readonly number[]
  readonly position: number
  readonly shuffle: boolean
}
