import type { Hand } from '@/core/hands/Hand'

/** A note handed to an AudioOutput, already in audio-clock time. */
export interface ScheduledNote {
  readonly midi: number
  /** Integer 1–127; picks the sample velocity layer. */
  readonly velocity: number
  /** AudioContext time of the onset. */
  readonly time: number
  /** Seconds of sound before the release starts (tempo and sustain already applied). */
  readonly duration: number
  readonly hand: Hand
  /** Onset falls inside a pre-roll count-in: routed through the pre-roll gain. */
  readonly preRoll: boolean
}
