import type { PlayerSettings } from './PlayerSettings'

/**
 * The effect sizes at the softest and loudest velocity, with the softest clamped to the loudest:
 * set higher, soft notes would burst bigger than loud ones. The stored values stay as set, so
 * raising Size at loudest again brings the softest size back (decision 47).
 */
export function velocityScaleBounds(
  effects: Pick<PlayerSettings['effects'], 'minScale' | 'maxScale'>,
): {
  readonly min: number
  readonly max: number
  readonly limited: boolean
} {
  const limited = effects.minScale > effects.maxScale
  return { min: limited ? effects.maxScale : effects.minScale, max: effects.maxScale, limited }
}
