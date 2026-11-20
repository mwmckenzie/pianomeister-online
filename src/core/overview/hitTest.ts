import type { HitTarget } from './HitTarget'

/** Handles and grips are thin: they take the pointer this many px beyond their box. */
const SLOP = 6

const GRIPS: ReadonlySet<HitTarget['kind']> = new Set([
  'loopStart',
  'loopEnd',
  'laneStart',
  'laneEnd',
])

/**
 * What's under the pointer, or null (the notes: select or seek). Grips (loop handles, a lane
 * item's ends) win over the boxes they sit on and reach SLOP px further; between two grips the
 * nearer one wins, so a one-bar loop's handles can both be grabbed.
 */
export function hitTest(targets: readonly HitTarget[], x: number, y: number): HitTarget | null {
  let best: HitTarget | null = null
  let bestDistance = Infinity
  for (const t of targets) {
    if (!GRIPS.has(t.kind)) continue
    const inY = y >= t.y && y <= t.y + t.height
    const centre = t.x + t.width / 2
    const distance = Math.abs(x - centre)
    if (inY && distance <= t.width / 2 + SLOP && distance < bestDistance) {
      best = t
      bestDistance = distance
    }
  }
  if (best !== null) return best
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i]
    if (t === undefined || GRIPS.has(t.kind)) continue
    if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) return t
  }
  return null
}
