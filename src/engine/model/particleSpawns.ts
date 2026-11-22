import type { ParticleSpawn } from './ParticleSpawn'

/** Onset effects (brief decision 117); any combination can be on. */
export type OnsetEffect = 'sparks' | 'scalingSparks' | 'flame' | 'explosion' | 'glitter'

/** Particle effects while a note sustains ('none' and 'glow' spawn nothing). */
export type SustainEffect = 'embers' | 'flames' | 'smoke'

/** An effect's tuning factors from the settings (1 = its base look). */
export interface EffectKnobs {
  readonly size: number
  readonly count: number
  readonly lifetime: number
  readonly spread: number
}

/** Base particles per second per held key. */
export const SUSTAIN_RATE: { readonly [E in SustainEffect]: number } = {
  embers: 10,
  flames: 22,
  smoke: 5,
}

type Rand = () => number

const between = (rand: Rand, lo: number, hi: number) => lo + (hi - lo) * rand()

/**
 * The particles of one onset effect on a key of `keyWidth`, `scale` from the note's velocity
 * (brief decision 47). Sparks keep the milestone 8 numbers at factor 1: 8 per onset, rising
 * 3–6.5 units/s, falling with gravity, 0.3–0.6 s.
 */
export function onsetSpawns(
  effect: OnsetEffect,
  keyWidth: number,
  knobs: EffectKnobs,
  scale: number,
  rand: Rand,
): readonly ParticleSpawn[] {
  const n = (base: number) => Math.max(1, Math.round(base * scale * knobs.count))
  const life = (lo: number, hi: number) => between(rand, lo, hi) * knobs.lifetime
  const size = (lo: number, hi: number) => between(rand, lo, hi) * scale * knobs.size
  const across = () => keyWidth * (rand() * 0.6 - 0.3)
  const out: ParticleSpawn[] = []
  switch (effect) {
    case 'sparks':
      for (let i = 0; i < n(8); i++) {
        out.push({
          kind: 'spark',
          dx: across(),
          dy: 0.05,
          dz: 0,
          vx: (rand() - 0.5) * 3 * knobs.spread,
          vy: 3 + rand() * 3.5,
          vz: -rand() * 2.5 * knobs.spread,
          life: life(0.3, 0.6),
          size: size(0.25, 0.45),
        })
      }
      break
    case 'scalingSparks':
      for (let i = 0; i < n(6); i++) {
        out.push({
          kind: 'scalingSpark',
          dx: across(),
          dy: 0.05,
          dz: 0,
          vx: (rand() - 0.5) * 4 * knobs.spread,
          vy: 4 + rand() * 4,
          vz: -rand() * 2 * knobs.spread,
          life: life(0.35, 0.6),
          size: size(1, 1.6),
        })
      }
      break
    case 'flame':
      for (let i = 0; i < n(6); i++) {
        out.push({
          kind: 'flame',
          dx: across() * 0.6,
          dy: 0.1,
          dz: 0,
          vx: (rand() - 0.5) * 0.8 * knobs.spread,
          vy: 2.5 + rand() * 2,
          vz: -rand() * 0.5 * knobs.spread,
          life: life(0.3, 0.5),
          size: size(0.45, 0.65),
        })
      }
      break
    case 'explosion': {
      out.push({
        kind: 'ring',
        dx: 0,
        dy: 0.15,
        dz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0.3 * knobs.lifetime,
        size: 0.3 * scale * knobs.size,
      })
      const debris = n(10)
      for (let i = 0; i < debris; i++) {
        const angle = (i / debris) * Math.PI * 2 + rand() * 0.4
        out.push({
          kind: 'debris',
          dx: 0,
          dy: 0.1,
          dz: 0,
          vx: Math.cos(angle) * 4 * knobs.spread,
          vy: 2 + rand() * 3,
          vz: Math.sin(angle) * 2 * knobs.spread,
          life: life(0.4, 0.6),
          size: size(0.15, 0.22),
        })
      }
      break
    }
    case 'glitter':
      for (let i = 0; i < n(14); i++) {
        out.push({
          kind: 'glitter',
          dx: across() * 1.4,
          dy: 0.1,
          dz: 0,
          vx: (rand() - 0.5) * 2 * knobs.spread,
          vy: 1 + rand() * 2.5,
          vz: -rand() * 1.5 * knobs.spread,
          life: life(0.6, 1),
          size: size(0.08, 0.14),
        })
      }
      break
  }
  return out
}

/** One particle of a sustain effect on a held key. */
export function sustainSpawn(
  effect: SustainEffect,
  keyWidth: number,
  knobs: EffectKnobs,
  scale: number,
  rand: Rand,
): ParticleSpawn {
  const dx = keyWidth * (rand() * 0.6 - 0.3)
  switch (effect) {
    case 'embers':
      return {
        kind: 'ember',
        dx,
        dy: 0.08,
        dz: 0,
        vx: (rand() - 0.5) * 0.6 * knobs.spread,
        vy: 0.8 + rand() * 0.8,
        vz: -rand() * 0.3 * knobs.spread,
        life: between(rand, 0.9, 1.4) * knobs.lifetime,
        size: between(rand, 0.1, 0.16) * scale * knobs.size,
      }
    case 'flames':
      return {
        kind: 'smallFlame',
        dx: dx * 0.5,
        dy: 0.06,
        dz: 0,
        vx: (rand() - 0.5) * 0.4 * knobs.spread,
        vy: 1.5 + rand(),
        vz: 0,
        life: between(rand, 0.25, 0.4) * knobs.lifetime,
        size: between(rand, 0.35, 0.5) * scale * knobs.size,
      }
    case 'smoke':
      return {
        kind: 'smoke',
        dx,
        dy: 0.15,
        dz: 0,
        vx: (rand() - 0.5) * 0.5 * knobs.spread,
        vy: 0.7 + rand() * 0.4,
        vz: -rand() * 0.2 * knobs.spread,
        life: between(rand, 1.4, 2) * knobs.lifetime,
        size: between(rand, 0.6, 0.8) * scale * knobs.size,
      }
  }
}

/** Reduced motion: one still flash for an onset, whatever effects are on (decision 54). */
export function flashSpawn(scale: number, knobs: EffectKnobs): ParticleSpawn {
  return {
    kind: 'flash',
    dx: 0,
    dy: 0.15,
    dz: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0.2 * knobs.lifetime,
    size: 1 * scale * knobs.size,
  }
}
