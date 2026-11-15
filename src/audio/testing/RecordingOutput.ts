import type { Clock } from '@/core/transport/Clock'

import type { AudioOutput } from '../AudioOutput'
import type { OutputGains } from '../OutputGains'
import type { ScheduledNote } from '../ScheduledNote'

/** Records what the scheduler asks for; "pending" means scheduled but not yet started. */
export class RecordingOutput implements AudioOutput {
  readonly notes: ScheduledNote[] = []
  readonly clicks: { time: number; accent: boolean }[] = []
  readonly cancelled: ScheduledNote[] = []
  readonly log: string[] = []
  gains: OutputGains | null = null
  releaseCount = 0

  constructor(private readonly clock: Clock) {}

  playNote(note: ScheduledNote): void {
    this.notes.push(note)
  }

  playClick(time: number, accent: boolean): void {
    this.clicks.push({ time, accent })
  }

  cancelPending(time: number): void {
    this.log.push(`cancelPending ${time}`)
    this.dropFrom(time)
  }

  releaseAll(): void {
    this.releaseCount++
    this.log.push('releaseAll')
    this.dropFrom(this.clock.now())
  }

  setGains(gains: OutputGains): void {
    this.gains = gains
  }

  /** Notes still due to play (not cancelled), in order. */
  get audible(): ScheduledNote[] {
    return [...this.notes].sort((a, b) => a.time - b.time)
  }

  private dropFrom(time: number): void {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i] as ScheduledNote
      if (n.time >= time) {
        this.cancelled.push(n)
        this.notes.splice(i, 1)
      }
    }
    for (let i = this.clicks.length - 1; i >= 0; i--) {
      if ((this.clicks[i] as { time: number }).time >= time) this.clicks.splice(i, 1)
    }
  }
}
