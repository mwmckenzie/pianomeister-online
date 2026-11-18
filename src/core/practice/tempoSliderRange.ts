/** Tempo limits (brief decision 60). */
const MIN_TEMPO = 25
const MAX_TEMPO = 200

/**
 * The tempo slider's range for a step (the Practice tab's tempo step, brief decision 81): the
 * slider snaps to min + k × step, so the range is anchored at 100% — 100% is always reachable,
 * and the ends are the furthest steps from it inside 25–200% (e.g. 28–200% for a step of 4).
 */
export function tempoSliderRange(step: number): {
  readonly min: number
  readonly max: number
  readonly step: number
} {
  const s = Math.max(1, Math.round(step))
  return {
    min: 100 - s * Math.floor((100 - MIN_TEMPO) / s),
    max: 100 + s * Math.floor((MAX_TEMPO - 100) / s),
    step: s,
  }
}
