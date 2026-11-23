/**
 * Log sliders (milestone 9.1 §B): perceptual settings (sizes, widths, strengths, counts,
 * lifetimes) spend the slider's travel evenly per ratio, not per unit, so the low end isn't
 * crammed into the first few pixels. The stored value stays the real one; only the slider's
 * position is mapped.
 *
 * A range that starts at 0 (where 0 means off) keeps a 0 stop at the far left; the log run then
 * starts at the first step. Positions are integers 0..LOG_SLIDER_STEPS.
 */
export const LOG_SLIDER_STEPS = 200

interface Range {
  readonly min: number
  readonly max: number
  readonly step: number
}

/** Where the log run starts: the min, or the first step above a 0 min. */
function logStart({ min, step }: Range): number {
  return min > 0 ? min : step
}

/** Snaps to the step grid from min (as the linear slider does) and into the range. */
export function snapToStep(value: number, { min, max, step }: Range): number {
  const snapped = min + Math.round((value - min) / step) * step
  // Rounding off float noise from the multiplication (0.1 × 3 = 0.30000000000000004).
  return Math.min(max, Math.max(min, Number(snapped.toPrecision(12))))
}

/** The slider position (0..LOG_SLIDER_STEPS) for a stored value. */
export function logSliderPosition(value: number, range: Range): number {
  const { min, max } = range
  const lo = logStart(range)
  const zeroStop = min < lo
  if (zeroStop && value < lo) return 0
  const first = zeroStop ? 1 : 0
  const span = LOG_SLIDER_STEPS - first
  const v = Math.min(max, Math.max(lo, value))
  return first + Math.round((span * Math.log(v / lo)) / Math.log(max / lo))
}

/** The stored value for a slider position, snapped to the step. */
export function logSliderValue(position: number, range: Range): number {
  const { min, max } = range
  const lo = logStart(range)
  const zeroStop = min < lo
  if (zeroStop && position <= 0) return min
  const first = zeroStop ? 1 : 0
  const span = LOG_SLIDER_STEPS - first
  const t = Math.min(1, Math.max(0, (position - first) / span))
  return snapToStep(lo * (max / lo) ** t, range)
}
