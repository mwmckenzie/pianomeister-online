/**
 * Particle kinds (brief decision 117) and how each moves and looks once spawned; the shader
 * reads these as uniform rows, the spawn rules (particleSpawns) choose positions and speeds.
 * - gravity: world units / s² on y (negative falls)
 * - drag: 1/s (velocity decays as e^(−drag·t))
 * - sizeEnd: size at the end of life, relative to the start
 * - stretch: elongation along the motion (flames)
 * - whiten: how white the particle starts (fades to its pitch colour)
 * - twinkle: brightness flicker (off under reduced motion)
 * - shape: 0 soft dot, 1 ring, 2 flame tongue
 * - fade: alpha falloff exponent over life (1 = linear)
 * - smoke: drawn with normal blending, no bloom
 */
export const PARTICLE_KINDS = {
  spark: {
    gravity: -14,
    drag: 0,
    sizeEnd: 1,
    stretch: 0,
    whiten: 0,
    twinkle: 0,
    shape: 0,
    fade: 1,
  },
  scalingSpark: {
    gravity: -12,
    drag: 0,
    sizeEnd: 0,
    stretch: 0,
    whiten: 0.3,
    twinkle: 0,
    shape: 0,
    fade: 0.6,
  },
  flame: {
    gravity: 3,
    drag: 3,
    sizeEnd: 1.6,
    stretch: 1.2,
    whiten: 0.6,
    twinkle: 0,
    shape: 2,
    fade: 1.4,
  },
  ring: {
    gravity: 0,
    drag: 0,
    sizeEnd: 10,
    stretch: 0,
    whiten: 0.4,
    twinkle: 0,
    shape: 1,
    fade: 1.5,
  },
  debris: {
    gravity: -12,
    drag: 0.5,
    sizeEnd: 0.6,
    stretch: 0.6,
    whiten: 0.2,
    twinkle: 0,
    shape: 0,
    fade: 1,
  },
  glitter: {
    gravity: -1.5,
    drag: 1.5,
    sizeEnd: 0.8,
    stretch: 0,
    whiten: 0.5,
    twinkle: 1,
    shape: 0,
    fade: 0.8,
  },
  ember: {
    gravity: 0.6,
    drag: 0.6,
    sizeEnd: 0.7,
    stretch: 0,
    whiten: 0.2,
    twinkle: 0.5,
    shape: 0,
    fade: 1.2,
  },
  smallFlame: {
    gravity: 2,
    drag: 2.5,
    sizeEnd: 0.3,
    stretch: 1,
    whiten: 0.5,
    twinkle: 0,
    shape: 2,
    fade: 1,
  },
  smoke: {
    gravity: 0.2,
    drag: 0.8,
    sizeEnd: 2.5,
    stretch: 0,
    whiten: 0,
    twinkle: 0,
    shape: 0,
    fade: 1.5,
  },
  /** Reduced motion: a still flash in place of any onset effect. */
  flash: {
    gravity: 0,
    drag: 0,
    sizeEnd: 1,
    stretch: 0,
    whiten: 0.3,
    twinkle: 0,
    shape: 0,
    fade: 2,
  },
} as const

export type ParticleKind = keyof typeof PARTICLE_KINDS

/** Shader index of each kind (rows of the kind table). */
export const KIND_INDEX: { readonly [K in ParticleKind]: number } = Object.fromEntries(
  Object.keys(PARTICLE_KINDS).map((k, i) => [k, i]),
) as { readonly [K in ParticleKind]: number }
