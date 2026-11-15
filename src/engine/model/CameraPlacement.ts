/** World-space camera placement, from cameraFit(). x right, y up, z toward the player. */
export interface CameraPlacement {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly target: { readonly x: number; readonly y: number; readonly z: number }
  readonly fovDeg: number
  /** z of the now line: the back edge of the white keys, where the highway starts. */
  readonly nowZ: number
  /** Visible highway: from the now line to where the top screen ray meets the ground (1.5x look-ahead). */
  readonly highwayLength: number
  /** The look-ahead part of the highway: its lower two thirds. The top third is the haze zone. */
  readonly lookAheadLength: number
}
