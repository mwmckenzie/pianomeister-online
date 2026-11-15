import type { OutputGains } from './OutputGains'
import type { ScheduledNote } from './ScheduledNote'

/** What the scheduler talks to. The browser uses SmplrOutput; tests use a recording fake. */
export interface AudioOutput {
  playNote(note: ScheduledNote): void
  /** A metronome click at an audio time; `accent` for downbeats. */
  playClick(time: number, accent: boolean): void
  /** Cancels notes and clicks scheduled at or after `time` that have not started yet. */
  cancelPending(time: number): void
  /** Quickly fades out everything sounding and cancels everything pending, without clicks. */
  releaseAll(): void
  setGains(gains: OutputGains): void
}
