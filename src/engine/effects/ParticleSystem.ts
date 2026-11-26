import {
  AdditiveBlending,
  BufferAttribute,
  type Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector4,
} from 'three'

import { GlowTwin } from '../GlowTwin'
import { KIND_INDEX, PARTICLE_KINDS } from '../model/PARTICLE_KINDS'
import { ParticleRing } from '../model/ParticleRing'
import type { ParticleSpawn } from '../model/ParticleSpawn'
import type { TimeUniforms } from '../TimeUniforms'

const KIND_COUNT = Object.keys(PARTICLE_KINDS).length

const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uClearTime;
uniform vec4 uKindA[${KIND_COUNT}]; // gravity, drag, size at end, stretch
uniform vec4 uKindB[${KIND_COUNT}]; // whiten, twinkle, shape, fade exponent
uniform float uReducedMotion;
attribute vec4 aStart;    // x, y, z, spawn time
attribute vec4 aVelocity; // vx, vy, vz, life
attribute vec4 aColor;    // r, g, b, size
attribute vec2 aKind;     // kind, seed
varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vShape;

void main() {
  float age = uTime - aStart.w;
  float life = aVelocity.w;
  if (age < 0.0 || age >= life || aStart.w < uClearTime) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  int k = int(aKind.x + 0.5);
  vec4 A = uKindA[k];
  vec4 B = uKindB[k];
  float t = age / life;
  // Closed-form motion from the spawn data: no per-frame state on the CPU.
  vec3 g = vec3(0.0, A.x, 0.0);
  float drag = A.y;
  vec3 p;
  vec3 v;
  if (drag > 1e-4) {
    float e = exp(-drag * age);
    float reach = (1.0 - e) / drag;
    p = aStart.xyz + aVelocity.xyz * reach + g * (age - reach) / drag;
    v = aVelocity.xyz * e + g * (1.0 - e) / drag;
  } else {
    p = aStart.xyz + aVelocity.xyz * age + 0.5 * g * age * age;
    v = aVelocity.xyz + g * age;
  }
  vec4 view = viewMatrix * vec4(p, 1.0);
  float size = aColor.w * mix(1.0, A.z, t);
  // Camera-facing, stretched along the motion on screen (flames).
  vec3 vv = mat3(viewMatrix) * v;
  float speed = length(vv.xy);
  vec2 dir = speed > 1e-4 ? vv.xy / speed : vec2(0.0, 1.0);
  // (perp, dir) is right-handed, so the quad keeps its front-facing winding.
  vec2 perp = vec2(dir.y, -dir.x);
  float stretch = 1.0 + A.w * min(speed * 0.25, 2.0);
  view.xy += (perp * position.x + dir * position.y * stretch) * size * 0.5;
  gl_Position = projectionMatrix * view;
  vCorner = position.xy;
  vColor = mix(aColor.rgb, vec3(1.0), B.x * (1.0 - t));
  float twinkle = 1.0 - B.y * (1.0 - uReducedMotion) * 0.6 * (0.5 + 0.5 * sin(uTime * 30.0 + aKind.y * 40.0));
  vAlpha = pow(1.0 - t, B.w) * twinkle;
  vShape = B.z;
}
`

const FRAGMENT = /* glsl */ `
varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vShape;

void main() {
  float r = length(vCorner);
  float f;
  if (vShape < 0.5) {
    float falloff = clamp(1.0 - r, 0.0, 1.0);
    f = falloff * falloff;
  } else if (vShape < 1.5) {
    f = exp(-pow((r - 0.75) / 0.09, 2.0)) * (1.0 - smoothstep(0.95, 1.0, r));
  } else {
    f = pow(clamp(1.0 - r, 0.0, 1.0), 1.5);
  }
  if (f * vAlpha <= 0.002) discard;
#ifdef SMOKE
  gl_FragColor = vec4(vColor, f * vAlpha * 0.35);
#else
  gl_FragColor = vec4(vColor * f * vAlpha, 1.0);
#endif
}
`

/** A particle to write: its emission point (world), colour and spawn data. */
export interface Emission {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly color: Color
  readonly spawn: ParticleSpawn
}

/**
 * One pool of GPU particles (brief decision 117): instanced quads whose motion, size and fade
 * are computed in the vertex shader from their spawn data and the animation clock. The CPU only
 * writes newly spawned slots (partial uploads); the ring hands out the oldest slots first, so
 * the pool never grows past its budget. Additive pools also bloom (glow twin); the smoke pool
 * blends normally and doesn't.
 */
export class ParticleSystem {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>
  readonly twin: GlowTwin<InstancedBufferGeometry> | null
  private ring: ParticleRing
  private start!: InstancedBufferAttribute
  private velocity!: InstancedBufferAttribute
  private color!: InstancedBufferAttribute
  private kind!: InstancedBufferAttribute
  private readonly clearTime = { value: -1e9 }
  /** When each slot's particle ends (uTime seconds), to count particles cut short. */
  private expiry: Float32Array
  /** When the last of them ends. */
  private lastEnd = -Infinity
  /** Live particles whose slot a new one took before they ended (the budget truncating). */
  private evicted = 0
  /** Random source for each particle's own variation; seeded in capture mode for tests. */
  random: () => number = Math.random

  constructor(
    capacity: number,
    private readonly time: TimeUniforms,
    private readonly smoke: boolean,
  ) {
    this.ring = new ParticleRing(capacity)
    this.expiry = new Float32Array(capacity)
    const kindA = Object.values(PARTICLE_KINDS).map(
      (k) => new Vector4(k.gravity, k.drag, k.sizeEnd, k.stretch),
    )
    const kindB = Object.values(PARTICLE_KINDS).map(
      (k) => new Vector4(k.whiten, k.twinkle, k.shape, k.fade),
    )
    this.mesh = new Mesh(
      this.buildGeometry(capacity),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        defines: smoke ? { SMOKE: '' } : {},
        uniforms: {
          uTime: time.uTime,
          uReducedMotion: time.uReducedMotion,
          uClearTime: this.clearTime,
          uKindA: { value: kindA },
          uKindB: { value: kindB },
        },
        transparent: true,
        depthWrite: false,
        blending: smoke ? NormalBlending : AdditiveBlending,
        side: DoubleSide,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = smoke ? 6.9 : 7
    this.twin = smoke ? null : new GlowTwin(this.mesh, 'emitter')
  }

  get capacity(): number {
    return this.ring.capacity
  }

  /** A new budget: a fresh pool (live particles are dropped). */
  setCapacity(capacity: number): void {
    if (capacity === this.ring.capacity) return
    this.ring = new ParticleRing(capacity)
    this.expiry = new Float32Array(capacity)
    this.lastEnd = -Infinity
    const old = this.mesh.geometry
    this.mesh.geometry = this.buildGeometry(capacity)
    old.dispose()
  }

  emit(emissions: readonly Emission[]): void {
    if (emissions.length === 0) return
    const now = this.time.uTime.value
    let i = emissions.length - Math.min(emissions.length, this.ring.capacity)
    for (const range of this.ring.allocate(emissions.length)) {
      for (let slot = range.start; slot < range.start + range.count; slot++, i++) {
        const e = emissions[i] as Emission
        const s = e.spawn
        this.start.setXYZW(slot, e.x + s.dx, e.y + s.dy, e.z + s.dz, now)
        this.velocity.setXYZW(slot, s.vx, s.vy, s.vz, s.life)
        this.color.setXYZW(slot, e.color.r, e.color.g, e.color.b, s.size)
        this.kind.setXY(slot, KIND_INDEX[s.kind], this.random())
        if ((this.expiry[slot] as number) > now) this.evicted++
        this.expiry[slot] = now + s.life
        this.lastEnd = Math.max(this.lastEnd, now + s.life)
      }
      for (const attribute of [this.start, this.velocity, this.color, this.kind]) {
        attribute.addUpdateRange(range.start * attribute.itemSize, range.count * attribute.itemSize)
        attribute.needsUpdate = true
      }
    }
  }

  /** An empty pool from its first slot (capture: the same slots, so the same blending order). */
  restart(): void {
    this.ring = new ParticleRing(this.ring.capacity)
    this.expiry.fill(0)
    this.lastEnd = -Infinity
    this.clearTime.value = -1e9
    // No life, nothing drawn.
    this.velocity.array.fill(0)
    this.velocity.clearUpdateRanges()
    this.velocity.needsUpdate = true
  }

  /** Hides every live particle (seek, song change) without touching the buffers. */
  clear(): void {
    this.clearTime.value = this.time.uTime.value + 1e-4
    this.expiry.fill(0)
    this.lastEnd = -Infinity
  }

  /** A particle was still alive in the frame drawn last. */
  get busy(): boolean {
    return this.lastEnd > this.time.uTime.value
  }

  /** Live particles now, the pool's size, and how many were cut short since the last reset. */
  stats(): { readonly live: number; readonly capacity: number; readonly evicted: number } {
    const now = this.time.uTime.value
    let live = 0
    for (const end of this.expiry) if (end > now) live++
    return { live, capacity: this.ring.capacity, evicted: this.evicted }
  }

  resetStats(): void {
    this.evicted = 0
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.twin?.dispose()
  }

  private buildGeometry(capacity: number): InstancedBufferGeometry {
    const g = new InstancedBufferGeometry()
    g.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
    )
    g.setIndex([0, 1, 2, 0, 2, 3])
    // Spawn time −∞: every slot starts dead.
    const start = new Float32Array(capacity * 4)
    for (let i = 0; i < capacity; i++) start[i * 4 + 3] = -1e9
    this.start = new InstancedBufferAttribute(start, 4)
    this.velocity = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
    this.color = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
    this.kind = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2)
    for (const a of [this.start, this.velocity, this.color, this.kind]) a.setUsage(DynamicDrawUsage)
    g.setAttribute('aStart', this.start)
    g.setAttribute('aVelocity', this.velocity)
    g.setAttribute('aColor', this.color)
    g.setAttribute('aKind', this.kind)
    g.instanceCount = capacity
    return g
  }
}
