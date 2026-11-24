/**
 * Consecutive cages of one hand drawn as one piece (milestone 10): the same keys and the same
 * kind (played or carried). Pieces of one region (the same keys, played then carried) have open
 * ends where they meet, so no border line is drawn between them.
 */
export interface HandCageRun {
  readonly startTick: number
  readonly endTick: number
  readonly low: number
  readonly high: number
  readonly carried: boolean
  readonly openStart: boolean
  readonly openEnd: boolean
}
