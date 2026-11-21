import type { NoteFill } from '@/core/settings/NoteFill'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import type { NoteStyleUniforms } from './NoteStyleUniforms'

/** Shader ids of the fill styles (NOTE_FILL_GLSL compares against these). */
export const FILL_ID: { readonly [F in NoteFill]: number } = {
  solid: 0,
  gradient: 1,
  hotCore: 2,
  glass: 3,
  neon: 4,
  stripes: 5,
  smoke: 6,
}

/** Smoke noise octaves per shader detail level. */
const OCTAVES = { minimal: 1, low: 1, medium: 2, high: 3 } as const

export function createNoteStyleUniforms(): NoteStyleUniforms {
  return {
    uHeadFill: { value: 0 },
    uSustainFill: { value: 0 },
    uGradientEnd: { value: 0.35 },
    uStripeWidth: { value: 0.35 },
    uStripeDrift: { value: 0 },
    uEdgeOn: { value: 0 },
    uEdgeWidth: { value: 0.04 },
    uEdgeIntensity: { value: 0.5 },
    uPulseOn: { value: 0 },
    uPulseAmount: { value: 0.5 },
    uPulseDecay: { value: 0.2 },
    uSoundingOn: { value: 0 },
    uSoundingAmount: { value: 0.3 },
    uBreathing: { value: 0 },
    uVelScaling: { value: 1 },
    uVelMin: { value: 0.6 },
    uVelMax: { value: 1.7 },
    uOctaves: { value: 2 },
  }
}

/** Writes the note style settings into the shared uniforms. */
export function applyNoteStyle(u: NoteStyleUniforms, settings: PlayerSettings): void {
  const { noteStyle: n, effects: e } = settings
  u.uHeadFill.value = FILL_ID[n.headFill]
  u.uSustainFill.value = FILL_ID[n.sustainFill]
  u.uGradientEnd.value = n.gradientEnd
  u.uStripeWidth.value = n.stripeWidth
  u.uStripeDrift.value = n.stripeDrift ? 1 : 0
  u.uEdgeOn.value = n.edgeGlow ? 1 : 0
  u.uEdgeWidth.value = n.edgeWidth
  u.uEdgeIntensity.value = n.edgeIntensity
  u.uPulseOn.value = e.pulse ? 1 : 0
  u.uPulseAmount.value = e.pulseAmount
  u.uPulseDecay.value = e.pulseDecayMs / 1000
  u.uSoundingOn.value = e.soundingGlow ? 1 : 0
  u.uSoundingAmount.value = e.soundingGlowAmount
  u.uBreathing.value = e.breathing ? 1 : 0
  u.uVelScaling.value = e.velocityScaling ? 1 : 0
  u.uVelMin.value = e.minScale
  u.uVelMax.value = e.maxScale
  u.uOctaves.value = OCTAVES[settings.render.shaderDetail]
}

/** True when the notes put anything on the glow layer (their twins are skipped otherwise). */
export function notesEmit(settings: PlayerSettings): boolean {
  const { noteStyle: n, effects: e } = settings
  const emissiveFill = (f: NoteFill) => f === 'hotCore' || f === 'neon'
  return (
    (n.edgeGlow && n.edgeIntensity > 0) ||
    (e.pulse && e.pulseAmount > 0) ||
    (e.soundingGlow && e.soundingGlowAmount > 0) ||
    emissiveFill(n.headFill) ||
    emissiveFill(n.sustainFill)
  )
}
