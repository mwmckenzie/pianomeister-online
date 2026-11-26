import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three'

import type { KeyBody } from '../model/KeyBody'
import { keyLayout } from '../model/keyLayout'
import { KEYBOARD } from '../model/KEYBOARD'
import type { KeyState } from '../model/KeyState'
import { NoteColors } from '../NoteColors'

/** A fading glow this close to its target doesn't change a pixel any more. */
const SETTLED = 5e-4

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

/** The default palette, until the engine hands over the shared one. */
const DEFAULT_COLORS = new NoteColors()

/**
 * The milestone 8 held-note glow ("Glow" while a note sustains, brief decision 117): one
 * additive point per key at the now line, gently pulsing while its note sounds (steady under
 * reduced motion) and fading out quickly after.
 */
export class HeldGlow {
  readonly points: Points<BufferGeometry, ShaderMaterial>
  private readonly position = new Float32Array(88 * 3)
  private readonly color = new Float32Array(88 * 3)
  private readonly size = new Float32Array(88)
  private readonly alpha = new Float32Array(88)
  private readonly level = new Float32Array(88)
  /** Velocity scale of each key's latest sounding note (kept while its glow fades out). */
  private readonly scale = new Float32Array(88).fill(1)
  private readonly baseSize = new Float32Array(88)
  private elapsed = 0
  /** A glow was still fading in the last update. */
  busy = false
  private readonly uScale = { value: 400 }

  constructor() {
    keyLayout().forEach((key, i) => {
      this.position.set(
        [key.x + key.width / 2, key.raised + 0.15, -KEYBOARD.whiteLength - 0.1],
        i * 3,
      )
      this.baseSize[i] = key.isBlack ? 1.6 : 2.2
      this.size[i] = this.baseSize[i] as number
    })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.position, 3))
    geometry.setAttribute('aColor', new BufferAttribute(this.color, 3))
    geometry.setAttribute('aSize', new BufferAttribute(this.size, 1))
    geometry.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1))
    this.points = new Points(
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
    this.points.frustumCulled = false
    this.points.renderOrder = 7
    this.recolor(DEFAULT_COLORS)
  }

  /** Pixel scale for point sizes: drawing-buffer height / (2·tan(fov/2)). */
  setScale(scale: number): void {
    this.uScale.value = scale
  }

  setKeyTops(bodies: readonly KeyBody[]): void {
    bodies.forEach((body, i) => {
      this.position[i * 3 + 1] = body.top + 0.15
    })
    this.markDirty(true)
  }

  update(
    dt: number,
    states: readonly KeyState[],
    scaleOf: (velocity: number) => number,
    reducedMotion: boolean,
    moving = true,
  ): void {
    // Paused, the pulse holds its phase (no snap), so the glow settles where it is.
    if (moving) this.elapsed += dt
    const step = Math.min(dt, 0.05)
    this.busy = false
    states.forEach((state, i) => {
      // Held: a mild steady pulse. Released: fade out quickly.
      if (state.sounding) this.scale[i] = scaleOf(state.velocity)
      this.size[i] = (this.baseSize[i] as number) * (this.scale[i] as number)
      const pulse = reducedMotion ? 0 : 0.12 * Math.sin(this.elapsed * 7 + i)
      const target = state.sounding ? 0.45 + pulse : 0
      const current = this.level[i] as number
      // Rise at once, fade toward the target, never below it: decaying past a held target and
      // snapping back would flicker every other frame.
      this.level[i] = target >= current ? target : Math.max(target, current * Math.exp(-step * 14))
      if ((this.level[i] as number) - target > SETTLED) this.busy = true
      this.alpha[i] = this.level[i] as number
    })
    this.markDirty(false)
  }

  /** The pulse starts over (capture: repeatable frames). */
  resetClock(): void {
    this.elapsed = 0
  }

  clear(): void {
    this.level.fill(0)
    this.alpha.fill(0)
    this.markDirty(false)
  }

  /** Takes the note colours of the palette (each key's glow is its note colour). */
  recolor(colors: NoteColors): void {
    keyLayout().forEach((key, i) => {
      const c = colors.at(key.midi % 12)
      this.color.set([c.r, c.g, c.b], i * 3)
    })
    this.points.geometry.getAttribute('aColor').needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    this.points.material.dispose()
  }

  private markDirty(moved: boolean): void {
    const attributes = this.points.geometry.attributes
    if (moved && attributes.position) attributes.position.needsUpdate = true
    for (const name of ['aSize', 'aAlpha']) {
      const attribute = attributes[name]
      if (attribute) attribute.needsUpdate = true
    }
  }
}
