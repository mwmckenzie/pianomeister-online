/** A run of consecutive slots in the particle buffer. */
export interface SlotRange {
  readonly start: number
  readonly count: number
}

/**
 * Slot allocation for the particle pool (brief decisions 110, 117): a ring buffer of the
 * preset's budget. New particles always get slots; when the pool is full they take the oldest
 * particles' slots, so under load the oldest go first and memory never grows.
 */
export class ParticleRing {
  private next = 0

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`Particle capacity must be a positive integer: ${capacity}`)
    }
  }

  /**
   * Slots for `n` new particles, as at most two ranges (the ring may wrap). More than the
   * capacity keeps only the last `capacity` (the newest).
   */
  allocate(n: number): readonly SlotRange[] {
    const count = Math.min(Math.max(0, Math.floor(n)), this.capacity)
    if (count === 0) return []
    const start = this.next
    this.next = (start + count) % this.capacity
    const first = Math.min(count, this.capacity - start)
    return first === count
      ? [{ start, count }]
      : [
          { start, count: first },
          { start: 0, count: count - first },
        ]
  }
}
