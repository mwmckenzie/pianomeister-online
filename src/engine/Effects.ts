import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Points,
  ShaderMaterial,
} from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'

import type { KeyBody } from './model/KeyBody'
import { keyLayout } from './model/keyLayout'
import { KEYBOARD } from './model/KEYBOARD'
import type { KeyState } from './model/KeyState'
import { srgb } from './srgb'

/** Hard cap on live sparks: dense chords recycle the oldest instead of growing the pool. */
const MAX_SPARKS = 512
const SPARKS_PER_ONSET = 8
const GRAVITY = -14

const VERTEX = /* glsl */ `
uniform float uScale;
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vAlpha = aAlpha;
  vColor = aColor;
  gl_PointSize = aAlpha > 0.0 ? aSize * uScale / -view.z : 0.0;
  gl_Position = projectionMatrix * view;
}
`

const FRAGMENT = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float falloff = clamp(1.0 - d, 0.0, 1.0);
  gl_FragColor = vec4(vColor * falloff * falloff * vAlpha, 1.0);
}
`

interface PointCloud {
  readonly points: Points<BufferGeometry, ShaderMaterial>
  readonly position: Float32Array
  readonly color: Float32Array
  readonly size: Float32Array
  readonly alpha: Float32Array
}

/**
 * Now-line effects, all additive points from fixed pools (no full-screen bloom):
 * a short spray of sparks on each onset, and a gently pulsing glow on each held key.
 */
export class Effects {
  readonly group = new Group()
  private readonly sparks: PointCloud
  private readonly glow: PointCloud
  private readonly velocity = new Float32Array(MAX_SPARKS * 3)
  private readonly life = new Float32Array(MAX_SPARKS)
  private readonly maxLife = new Float32Array(MAX_SPARKS)
  private nextSpark = 0
  private readonly glowLevel = new Float32Array(88)
  /** Velocity scale of each key's latest sounding note (kept while its glow fades out). */
  private readonly glowScale = new Float32Array(88).fill(1)
  private readonly glowBaseSize = new Float32Array(88)
  /** Key top heights, from the keyboard settings. */
  private readonly keyTop = new Float32Array(88)
  private elapsed = 0
  private readonly uScale = { value: 400 }

  constructor() {
    this.sparks = this.cloud(MAX_SPARKS)
    this.glow = this.cloud(88)
    keyLayout().forEach((key, i) => {
      this.glow.position.set(
        [key.x + key.width / 2, key.raised + 0.15, -KEYBOARD.whiteLength - 0.1],
        i * 3,
      )
      const c = srgb(PITCH_CLASS_COLORS[key.midi % 12]?.hex ?? '#FFFFFF')
      this.glow.color.set([c.r, c.g, c.b], i * 3)
      this.glowBaseSize[i] = key.isBlack ? 1.6 : 2.2
      this.glow.size[i] = this.glowBaseSize[i] as number
      this.keyTop[i] = key.raised
    })
    this.markDirty(this.glow, true)
    this.group.add(this.glow.points, this.sparks.points)
  }

  /** Pixel scale for point sizes: drawing-buffer height / (2·tan(fov/2)). */
  setScale(scale: number): void {
    this.uScale.value = scale
  }

  /** Places the glow and spark origins on the key tops (they move with the black key height). */
  setKeyTops(bodies: readonly KeyBody[]): void {
    bodies.forEach((body, i) => {
      this.keyTop[i] = body.top
      this.glow.position[i * 3 + 1] = body.top + 0.15
    })
    this.markDirty(this.glow, true)
  }

  /** A burst on an onset; `scale` (from the note's velocity) sizes the burst and its sparks. */
  spawn(midi: number, scale = 1): void {
    const index = midi - KEYBOARD.lowest
    const key = keyLayout()[index]
    if (key === undefined) return
    const top = this.keyTop[index] as number
    const c = srgb(PITCH_CLASS_COLORS[midi % 12]?.hex ?? '#FFFFFF')
    const count = Math.max(1, Math.round(SPARKS_PER_ONSET * scale))
    for (let n = 0; n < count; n++) {
      const i = this.nextSpark
      this.nextSpark = (this.nextSpark + 1) % MAX_SPARKS
      this.sparks.position.set(
        [key.x + key.width * (0.2 + 0.6 * Math.random()), top + 0.05, -KEYBOARD.whiteLength],
        i * 3,
      )
      this.velocity.set(
        [(Math.random() - 0.5) * 3, 3 + Math.random() * 3.5, -Math.random() * 2.5],
        i * 3,
      )
      this.sparks.color.set([c.r, c.g, c.b], i * 3)
      this.sparks.size[i] = (0.25 + Math.random() * 0.2) * scale
      this.maxLife[i] = 0.3 + Math.random() * 0.3
      this.life[i] = this.maxLife[i] as number
    }
  }

  /**
   * Advances sparks and glow by `dt` seconds; `states` are the 88 key states in key order.
   * `scaleOf` maps a sounding note's velocity to the held glow's size.
   */
  update(dt: number, states: readonly KeyState[], scaleOf: (velocity: number) => number): void {
    this.elapsed += dt
    const step = Math.min(dt, 0.05)
    for (let i = 0; i < MAX_SPARKS; i++) {
      const life = this.life[i] as number
      if (life <= 0) {
        this.sparks.alpha[i] = 0
        continue
      }
      const remaining = life - step
      this.life[i] = remaining
      const v = i * 3
      this.velocity[v + 1] = (this.velocity[v + 1] as number) + GRAVITY * step
      for (let axis = 0; axis < 3; axis++) {
        this.sparks.position[v + axis] =
          (this.sparks.position[v + axis] as number) + (this.velocity[v + axis] as number) * step
      }
      this.sparks.alpha[i] = Math.max(0, remaining / (this.maxLife[i] as number))
    }
    states.forEach((state, i) => {
      // Held: a mild steady pulse. Released: fade out quickly.
      if (state.sounding) this.glowScale[i] = scaleOf(state.velocity)
      this.glow.size[i] = (this.glowBaseSize[i] as number) * (this.glowScale[i] as number)
      const target = state.sounding ? 0.45 + 0.12 * Math.sin(this.elapsed * 7 + i) : 0
      const current = this.glowLevel[i] as number
      this.glowLevel[i] = target > current ? target : current * Math.exp(-step * 14)
      this.glow.alpha[i] = this.glowLevel[i] as number
    })
    this.markDirty(this.sparks, true)
    this.markDirty(this.glow, false)
  }

  clear(): void {
    this.life.fill(0)
    this.sparks.alpha.fill(0)
    this.glowLevel.fill(0)
    this.glow.alpha.fill(0)
    this.markDirty(this.sparks, true)
    this.markDirty(this.glow, false)
  }

  dispose(): void {
    for (const cloud of [this.sparks, this.glow]) {
      cloud.points.geometry.dispose()
      cloud.points.material.dispose()
    }
  }

  private cloud(count: number): PointCloud {
    const position = new Float32Array(count * 3)
    const color = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const alpha = new Float32Array(count)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    geometry.setAttribute('aColor', new BufferAttribute(color, 3))
    geometry.setAttribute('aSize', new BufferAttribute(size, 1))
    geometry.setAttribute('aAlpha', new BufferAttribute(alpha, 1))
    const points = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uScale: this.uScale },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    )
    points.frustumCulled = false
    points.renderOrder = 7
    return { points, position, color, size, alpha }
  }

  private markDirty(cloud: PointCloud, moved: boolean): void {
    const attributes = cloud.points.geometry.attributes
    if (moved && attributes.position) attributes.position.needsUpdate = true
    for (const name of ['aColor', 'aSize', 'aAlpha']) {
      const attribute = attributes[name]
      if (attribute) attribute.needsUpdate = true
    }
  }
}
