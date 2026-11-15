export interface BeatEvent {
  readonly bar: number
  /** 1-based. */
  readonly beat: number
  readonly isDownbeat: boolean
  readonly isPreRoll: boolean
  /** Song seconds at 100% tempo. */
  readonly songSec: number
}
