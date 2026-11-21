import { Vector2, Vector4 } from 'three'

import type { NoteFill } from '@/core/settings/NoteFill'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import type { NoteStyleUniforms } from './NoteStyleUniforms'
import type { StripeStyle } from './StripeStyle'
import { writeStripes } from './writeStripes'

/** Shader ids of the fill styles (NOTE_FILL_GLSL compares against these). */
export const FILL_ID: { readonly [F in NoteFill]: number } = {
  solid: 0,
  gradient: 1,
  hotCore: 2,
  glass: 3,
  outline: 4,
  neon: 5,
  stripes: 6,
  smoke: 7,
}

/** Smoke noise octaves per shader detail level. */
const OCTAVES = { minimal: 1, low: 1, medium: 2, high: 3 } as const

export function createNoteStyleUniforms(): NoteStyleUniforms {
  const stripe = () => ({
    a: { value: new Vector4(1, 1, 1, 0) },
    b: { value: new Vector4(0, 0, 0, 1) },
    opacity: { value: new Vector2(1, 1) },
    shape: { value: new Vector4(0.35, 0.5, Math.PI / 4, 0) },
  })
  const head = stripe()
  const sustain = stripe()
  return {
    uHeadFill: { value: 0 },
    uSustainFill: { value: 0 },
    uGradientEnd: { value: 0.35 },
    uNeonFlicker: { value: 0 },
    uHeadStripeA: head.a,
    uHeadStripeB: head.b,
    uHeadStripeOpacity: head.opacity,
    uHeadStripeShape: head.shape,
    uSustainStripeA: sustain.a,
    uSustainStripeB: sustain.b,
    uSustainStripeOpacity: sustain.opacity,
    uSustainStripeShape: sustain.shape,
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

/** A note use's stripe settings ('head' or 'sustain') as a StripeStyle. */
export function noteStripes(n: PlayerSettings['noteStyle'], use: 'head' | 'sustain'): StripeStyle {
  const field = <K extends string>(name: K) => n[`${use}Stripe${name}` as keyof typeof n]
  return {
    a: { mode: field('A') as StripeStyle['a']['mode'], color: field('ACustom') as string },
    b: { mode: field('B') as StripeStyle['b']['mode'], color: field('BCustom') as string },
    aOpacity: field('AOpacity') as number,
    bOpacity: field('BOpacity') as number,
    width: field('Width') as number,
    balance: field('Balance') as number,
    angleDeg: field('Angle') as number,
    drift: field('Drift') as boolean,
  }
}

/** Writes the note style settings into the shared uniforms. */
export function applyNoteStyle(u: NoteStyleUniforms, settings: PlayerSettings): void {
  const { noteStyle: n, effects: e } = settings
  u.uHeadFill.value = FILL_ID[n.headFill]
  u.uSustainFill.value = FILL_ID[n.sustainFill]
  u.uGradientEnd.value = n.gradientEnd
  u.uNeonFlicker.value = n.neonFlicker ? 1 : 0
  writeStripes(u, 'uHeadStripe', noteStripes(n, 'head'))
  writeStripes(u, 'uSustainStripe', noteStripes(n, 'sustain'))
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

/** Fills that put something on the glow scene by themselves. */
export const EMISSIVE_FILLS: ReadonlySet<NoteFill> = new Set(['hotCore', 'outline', 'neon'])

/** True when the notes put anything on the glow scene (their twins are skipped otherwise). */
export function notesEmit(settings: PlayerSettings): boolean {
  const { noteStyle: n, effects: e } = settings
  return (
    (n.edgeGlow && n.edgeIntensity > 0) ||
    (e.pulse && e.pulseAmount > 0) ||
    (e.soundingGlow && e.soundingGlowAmount > 0) ||
    EMISSIVE_FILLS.has(n.headFill) ||
    EMISSIVE_FILLS.has(n.sustainFill)
  )
}
