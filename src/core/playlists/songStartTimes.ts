import { GAP_AT_ZERO_SEC } from './GAP_AT_ZERO_SEC'

/**
 * When each song of a playlist starts, in seconds from the first (milestone 9.5 D): the next song
 * starts `crossfade` seconds before the current one ends, so their fades overlap; at 0 there's a
 * short gap instead (GAP_AT_ZERO_SEC). An overlap never takes more than half of either song, so a
 * very short song still plays on its own for a while.
 */
export function songStartTimes(durations: readonly number[], crossfadeSec: number): number[] {
  const starts: number[] = []
  let at = 0
  durations.forEach((duration, i) => {
    starts.push(at)
    const next = durations[i + 1]
    if (next === undefined) return
    at +=
      crossfadeSec <= 0
        ? duration + GAP_AT_ZERO_SEC
        : duration - Math.min(crossfadeSec, duration / 2, next / 2)
  })
  return starts
}
