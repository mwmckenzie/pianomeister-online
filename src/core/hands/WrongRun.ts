/** Consecutive notes a split method gave to the wrong hand. */
export interface WrongRun {
  readonly notes: number
  /** From the first wrong note's start to the last one's. */
  readonly seconds: number
  readonly startBar: number
  readonly startSeconds: number
  /** The run's notes of each hand, all given to the other one. Both above 0: the hands swapped. */
  readonly rightGivenLeft: number
  readonly leftGivenRight: number
}
