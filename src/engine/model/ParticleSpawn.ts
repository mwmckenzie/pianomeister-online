import type { ParticleKind } from './PARTICLE_KINDS'

/**
 * One particle to spawn, relative to its key's emission point (centre of the key top at the
 * now line): offset and velocity in world units, life in seconds, size = world diameter.
 */
export interface ParticleSpawn {
  readonly kind: ParticleKind
  readonly dx: number
  readonly dy: number
  readonly dz: number
  readonly vx: number
  readonly vy: number
  readonly vz: number
  readonly life: number
  readonly size: number
}
