import type { Clock } from '../transport/Clock'

export class FakeClock implements Clock {
  constructor(private time = 0) {}

  now(): number {
    return this.time
  }

  advance(seconds: number): void {
    this.time += seconds
  }
}
