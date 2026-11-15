import type { Clock } from '@/core/transport/Clock'

/** The audio clock is the master timeline; the transport reads it rather than wall time. */
export class AudioContextClock implements Clock {
  constructor(private readonly context: AudioContext) {}

  now(): number {
    return this.context.currentTime
  }
}
