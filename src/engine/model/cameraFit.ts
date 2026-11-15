import type { CameraPlacement } from './CameraPlacement'
import { KEYBOARD } from './KEYBOARD'

/** Gap between the screen edges and the keyboard front (bottom) / highway end (top), in NDC. */
export const FRAME_MARGIN = 0.03
/** The visible highway shows this many look-aheads: the look-ahead plus a haze zone of half that. */
export const HIGHWAY_LOOKAHEADS = 1.5
/** Shallow tilts aim the top of the screen at (or above) the horizon; cap the highway there. */
export const MAX_HIGHWAY_LENGTH = 300
const MIN_HIGHWAY_LENGTH = 3
const MIN_TOP_RAY_DEG = 0.5

const DEG = Math.PI / 180

/**
 * Places the camera in closed form. At distanceOffset 0 and pan 0 the keyboard front edge spans
 * the full viewport width; it always sits on the bottom margin. A positive offset moves the
 * camera farther along its view ray, a negative one closer (cropping the outer keys). The
 * visible highway ends where the top screen ray meets the ground, and that length is 1.5× the
 * look-ahead, so notes fade through a haze in the top third before reaching the screen edge.
 */
export function cameraFit(input: {
  readonly tiltDeg: number
  readonly fovDeg: number
  readonly aspect: number
  readonly distanceOffset: number
  readonly pan: number
}): CameraPlacement {
  const tilt = input.tiltDeg * DEG
  const halfFov = Math.tan((input.fovDeg * DEG) / 2)
  const centerX = KEYBOARD.width / 2 + input.pan
  const nowZ = -KEYBOARD.whiteLength

  // Depth of the front edge along the view axis that makes it span the viewport width.
  const depth = (KEYBOARD.width / 2 / (input.aspect * halfFov)) * (1 + input.distanceOffset)

  // Put the front edge (at the origin's height and z) on the bottom-margin screen ray.
  const bottomAngle = Math.atan((1 - FRAME_MARGIN) * halfFov)
  const rayDistance = depth / Math.cos(bottomAngle)
  const down = tilt + bottomAngle
  const position = {
    x: centerX,
    y: rayDistance * Math.sin(down),
    z: rayDistance * Math.cos(down),
  }
  const target = {
    x: centerX,
    y: position.y - depth * Math.sin(tilt),
    z: position.z - depth * Math.cos(tilt),
  }

  // Where the top-margin screen ray meets the ground (y = 0).
  const topDown = tilt - Math.atan((1 - FRAME_MARGIN) * halfFov)
  let highwayLength = MAX_HIGHWAY_LENGTH
  if (topDown > MIN_TOP_RAY_DEG * DEG) {
    const farZ = position.z - position.y / Math.tan(topDown)
    highwayLength = Math.min(MAX_HIGHWAY_LENGTH, Math.max(MIN_HIGHWAY_LENGTH, nowZ - farZ))
  }

  return {
    position,
    target,
    fovDeg: input.fovDeg,
    nowZ,
    highwayLength,
    lookAheadLength: highwayLength / HIGHWAY_LOOKAHEADS,
  }
}
