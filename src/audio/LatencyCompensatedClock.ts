import type { Clock } from '@/core/transport/Clock'

/**
 * The audio clock minus the output latency: what is audible right now. Visuals use it so key
 * lights match the sound; scheduling keeps using the raw clock.
 */
export class LatencyCompensatedClock implements Clock {
  constructor(private readonly context: AudioContext) {}

  now(): number {
    const latency = this.context.outputLatency || this.context.baseLatency || 0
    return this.context.currentTime - latency
  }
}
