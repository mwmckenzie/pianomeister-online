import type { IUniform, Vector2, Vector4 } from 'three'

/**
 * Uniforms shared by every note layer (heads, sustains, flat heads): fill styles, stripes,
 * edge rims, pulse, sounding glow (brief decisions 112–113). One object, so one settings
 * change restyles every layer.
 */
export interface NoteStyleUniforms {
  [name: string]: IUniform<unknown>
  /** Fill style ids, see FILL_ID. */
  uHeadFill: IUniform<number>
  uSustainFill: IUniform<number>
  uGradientEnd: IUniform<number>
  uNeonFlicker: IUniform<number>
  /** Stripes per use (see stripeUniforms). */
  uHeadStripeA: IUniform<Vector4>
  uHeadStripeB: IUniform<Vector4>
  uHeadStripeOpacity: IUniform<Vector2>
  uHeadStripeShape: IUniform<Vector4>
  uSustainStripeA: IUniform<Vector4>
  uSustainStripeB: IUniform<Vector4>
  uSustainStripeOpacity: IUniform<Vector2>
  uSustainStripeShape: IUniform<Vector4>
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
