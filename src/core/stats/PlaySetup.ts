import type { MetronomeMode } from '../practice/MetronomeMode'
import type { LoopRange } from '../transport/LoopRange'

/**
 * The setup in effect during a stretch of play (brief decision 70), kept with each play record
 * for a later stats page (tempo progress per bookmark).
 */
export interface PlaySetup {
  readonly tempoPercent: number
  /** The effective loop, or null for the whole song. */
  readonly loop: LoopRange | null
  readonly metronomeMode: MetronomeMode
  /** The loaded bookmark had temporary changes (never true for Full song). */
  readonly temporary: boolean
}
