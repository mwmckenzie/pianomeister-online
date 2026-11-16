import type { PlayerSettings } from '@/core/settings/PlayerSettings'

/** Effect size factor for a MIDI velocity (0–127): linear from minScale to maxScale, or 1. */
export function velocityScale(velocity: number, effects: PlayerSettings['effects']): number {
  if (!effects.velocityScaling) return 1
  const t = Math.min(1, Math.max(0, velocity / 127))
  return effects.minScale + (effects.maxScale - effects.minScale) * t
}
