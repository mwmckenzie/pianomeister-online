import type { IUniform } from 'three'

/**
 * Uniforms shared by every note layer (heads, sustains, flat heads) and the pedal cage's fill:
 * fill styles, edge rims, pulse, sounding glow (brief decisions 112–113). One object, so one
 * settings change restyles every layer.
 */
export interface NoteStyleUniforms {
  [name: string]: IUniform<number>
  /** Fill style ids, see FILL_ID. */
  uHeadFill: IUniform<number>
  uSustainFill: IUniform<number>
  uGradientEnd: IUniform<number>
  uStripeWidth: IUniform<number>
  uStripeDrift: IUniform<number>
  uEdgeOn: IUniform<number>
  uEdgeWidth: IUniform<number>
  uEdgeIntensity: IUniform<number>
  uPulseOn: IUniform<number>
  uPulseAmount: IUniform<number>
  /** Seconds. */
  uPulseDecay: IUniform<number>
  uSoundingOn: IUniform<number>
  uSoundingAmount: IUniform<number>
  uBreathing: IUniform<number>
  uVelScaling: IUniform<number>
  uVelMin: IUniform<number>
  uVelMax: IUniform<number>
  /** Noise octaves for Smoke (shader detail). */
  uOctaves: IUniform<number>
}
