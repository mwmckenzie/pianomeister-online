import type { TimeUniforms } from './TimeUniforms'

export function createTimeUniforms(): TimeUniforms {
  return {
    uTick: { value: 0 },
    uUnitsPerTick: { value: 0.01 },
    uNowZ: { value: 0 },
    uLookAheadTicks: { value: 3840 },
    uTime: { value: 0 },
    uTicksPerSecond: { value: 0 },
    uJumpTick: { value: -1e9 },
    uReducedMotion: { value: 0 },
  }
}
