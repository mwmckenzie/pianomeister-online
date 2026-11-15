import type { HandAssignment } from '../hands/HandAssignment'
import type { LoopRange } from '../transport/LoopRange'
import type { PreRollMode } from '../transport/PreRollMode'
import type { HandAudio } from './HandAudio'

/** A practice setup, as saved in a bookmark (docs/brief.md data model). Mute/solo applies in milestone 2. */
export interface PracticeConfig {
  readonly loop: LoopRange | null
  readonly tempoPercent: number
  readonly hands: HandAssignment
  readonly handAudio: { readonly right: HandAudio; readonly left: HandAudio }
  readonly preRollBeats: number
  readonly preRollMode: PreRollMode
}
