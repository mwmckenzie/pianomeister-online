import type { HandAudio } from './HandAudio'

interface HandChannelMix {
  /** 0–1. */
  readonly volume: number
  readonly audio: HandAudio
}

/** Per-hand audio settings. Audio only: never affects what is shown. */
export interface HandMix {
  readonly right: HandChannelMix
  readonly left: HandChannelMix
}
