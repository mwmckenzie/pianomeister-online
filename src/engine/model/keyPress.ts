/** Seconds for a key to travel fully down and fully up. */
export const KEY_PRESS_SECONDS = 0.04
export const KEY_RELEASE_SECONDS = 0.09
/** Where a re-struck key (new onset while it is down) restarts its press from. */
export const KEY_RESTRIKE_PROGRESS = 0.5

/**
 * Advances a key's press progress (0 = up, 1 = down) by `dt` seconds toward its target. It
 * moves at a constant rate, so it can never pass the target: no overshoot.
 */
export function keyPressStep(progress: number, down: boolean, dt: number): number {
  if (down) return Math.min(1, progress + dt / KEY_PRESS_SECONDS)
  return Math.max(0, progress - dt / KEY_RELEASE_SECONDS)
}

/**
 * Rotation (radians) about a pivot `pivotOffset` behind the key's back edge, for a progress:
 * smoothstep-eased, so the key starts and stops softly, and at full press the front edge
 * (pivotOffset + length from the pivot) has dropped by `depth`. A pivot far behind the key, like
 * a real key's balance rail, makes the key drop almost level with a slight tilt.
 */
export function keyPressAngle(
  progress: number,
  depth: number,
  length: number,
  pivotOffset = 0,
): number {
  const p = Math.min(1, Math.max(0, progress))
  const eased = p * p * (3 - 2 * p)
  const arm = Math.max(pivotOffset + length, 1e-6)
  return Math.asin(Math.min(1, depth / arm)) * eased
}
