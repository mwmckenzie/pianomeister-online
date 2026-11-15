/** The count-in before a target bar. Its beats use the tempo and meter at the target. */
export interface PreRollWindow {
  readonly startSec: number
  /** The target bar's start; positions before it are pre-roll. */
  readonly endSec: number
  readonly targetTick: number
  readonly beats: number
  readonly beatSec: number
  readonly ticksPerBeat: number
}
