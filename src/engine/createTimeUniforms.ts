import type { TimeUniforms } from './TimeUniforms'

export function createTimeUniforms(): TimeUniforms {
  return {
    uTick: { value: 0 },
    uUnitsPerTick: { value: 0.01 },
    uNowZ: { value: 0 },
    uLookAheadTicks: { value: 3840 },
  }
}
