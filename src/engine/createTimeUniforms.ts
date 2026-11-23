import type { TimeUniforms } from './TimeUniforms'

export function createTimeUniforms(): TimeUniforms {
  return {
    uTick: { value: 0 },
    uUnitsPerTick: { value: 0.01 },
    uNowZ: { value: 0 },
    uLookAheadTicks: { value: 3840 },
    uTime: { value: 0 },
    uLoopTime: { value: 0 },
    uPausedFor: { value: 0 },
    uTicksPerSecond: { value: 0 },
    uJumpTick: { value: -1e9 },
    uReducedMotion: { value: 0 },
    uClipLo: { value: -1e9 },
    uClipHi: { value: 1e9 },
    uLoopStart: { value: 0 },
    uLoopEnd: { value: 0 },
    uLoopPeriod: { value: 0 },
    uLoopRepeat: { value: 0 },
    uLoopDim: { value: 0 },
  }
}
