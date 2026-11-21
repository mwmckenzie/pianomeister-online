/** Bigger forward steps than this (in quarter notes) are jumps (seek), not playback. */
export const MAX_PLAY_STEP_QUARTERS = 2

/** How quickly the measured tick rate follows a tempo change (per second). */
const RATE_SMOOTHING = 8

/**
 * One frame of the song clock: whether the position jumped (seek, loop wrap, song load; a jump
 * starts no pulses for notes before it, brief decision 113) and the smoothed playback rate in
 * ticks per second. While not playing, any move is a seek, so seeking while paused never
 * starts a pulse; the rate holds its last value, so pulses in flight keep their speed.
 */
export function songClock(
  lastTick: number | null,
  tick: number,
  dt: number,
  ppq: number,
  rate: number,
  playing = true,
): { readonly jumped: boolean; readonly rate: number } {
  if (lastTick === null) return { jumped: true, rate }
  const step = tick - lastTick
  if (!playing) return { jumped: step !== 0, rate }
  if (step < 0 || step > MAX_PLAY_STEP_QUARTERS * ppq) return { jumped: true, rate }
  if (step === 0 || dt <= 0) return { jumped: false, rate }
  const measured = step / dt
  if (rate <= 0) return { jumped: false, rate: measured }
  const k = 1 - Math.exp(-RATE_SMOOTHING * dt)
  return { jumped: false, rate: rate + (measured - rate) * k }
}
