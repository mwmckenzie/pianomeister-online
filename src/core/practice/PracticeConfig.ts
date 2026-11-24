import type { LoopRange } from '../transport/LoopRange'
import type { PreRollMode } from '../transport/PreRollMode'
import type { HandAudio } from './HandAudio'
import type { MetronomeMode } from './MetronomeMode'

/**
 * A practice setup: what a bookmark saves and what the player applies (brief decision 67).
 * A song's hands are per song per profile, and volumes (the metronome's too) are global,
 * so neither is part of it; the metronome mode is (decision 61). A null loop means the
 * whole song.
 */
export interface PracticeConfig {
  readonly loop: LoopRange | null
  readonly tempoPercent: number
  readonly handAudio: { readonly right: HandAudio; readonly left: HandAudio }
  readonly preRollBeats: number
  readonly preRollMode: PreRollMode
  readonly metronomeMode: MetronomeMode
}
