import type { CrossfadeCurve } from './CrossfadeCurve'

/** Sequential: each song's fade takes this much of the crossfade, so they barely overlap. */
const SEQUENTIAL_PART = 0.6

const ease = (t: number) => Math.cos((Math.min(1, Math.max(0, t)) * Math.PI) / 2) ** 2

/** The ending song's gain; the next song's is its mirror image. */
function outGain(t: number, curve: CrossfadeCurve): number {
  if (curve === 'sequential') return t >= SEQUENTIAL_PART ? 0 : ease(t / SEQUENTIAL_PART)
  if (t >= 1) return 0
  return curve === 'sCurve' ? ease(t) : Math.cos((t * Math.PI) / 2)
}

/**
 * The two gains at `progress` 0..1 through a crossfade (milestone 9.5 D2). Sequential: out over
 * the first 60 %, in over the last 60 % (a short, quiet overlap). S-curve: cosine squared, half
 * each in the middle. Equal power: even loudness, both loud in the middle. The highway's
 * crossfade band follows the same `out` (timeGlsl).
 */
export function crossfadeGains(
  progress: number,
  curve: CrossfadeCurve,
): { readonly out: number; readonly in: number } {
  const t = Math.min(1, Math.max(0, progress))
  return { out: outGain(t, curve), in: outGain(1 - t, curve) }
}
