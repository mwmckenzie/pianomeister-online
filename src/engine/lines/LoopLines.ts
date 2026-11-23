import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three'

import { GlowTwin } from '../GlowTwin'
import { KEYBOARD } from '../model/KEYBOARD'
import { srgb } from '../srgb'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { LINE_AA_GLSL } from './LINE_AA_GLSL'

/** How far a line's quad reaches past its core, for the halo and aura. */
const MARGIN = 0.35
/** The end line glows this much stronger than the start line: the end is what surprises. */
const END_GLOW = 1.5

const VERTEX = /* glsl */ `
${TIME_GLSL}
uniform float uWidth;
attribute float aTick;
attribute float aEnd;   // 1 = a loop end, 0 = a loop start
varying float vTick;
varying float vAlong;
varying float vEnd;
void main() {
  float ahead = aTick - uTick;
  // Behind the now line or past the haze: collapsed.
  float visible = step(0.0, ahead) * step(ahead, 1.5 * uLookAheadTicks);
  float extent = (uWidth + 2.0 * ${MARGIN.toFixed(2)}) * visible;
  float along = (position.y - 0.5) * extent;
  vec3 world = vec3(position.x * ${KEYBOARD.width.toFixed(1)}, 0.006, tickToZ(aTick) - along);
  vTick = aTick;
  vAlong = along;
  vEnd = aEnd;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
${LINE_AA_GLSL}
uniform vec3 uColor;
uniform float uWidth;
uniform float uGlow;
varying float vTick;
varying float vAlong;
varying float vEnd;
void main() {
  float haze = hazeAlpha(vTick);
  float core = lineCoverage(vAlong, uWidth);
  float glow = uGlow * mix(1.0, ${END_GLOW.toFixed(1)}, vEnd);
#ifdef GLOW_PASS
  gl_FragColor = vec4(glowHue(uColor) * max(core, glowAura(vAlong, uWidth)) * glow * haze, 1.0);
#else
  float halo = 0.35 * min(glow, 1.0) * exp(-abs(vAlong) / min(1.5 * uWidth + 1e-3, 0.15));
  float alpha = haze * max(core, halo);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
#endif
}
`

/**
 * Loop boundary lines (milestone 9.2): a line across the highway at the loop start and end,
 * and at each repeat's seams. Drawn by the same line coverage and glow as the other highway
 * lines, under the notes. Never dimmed: they frame the practice section.
 */
export class LoopLines {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>
  readonly twin: GlowTwin<InstancedBufferGeometry>
  private readonly ticks: InstancedBufferAttribute
  private readonly ends: InstancedBufferAttribute
  private key = ''

  constructor(time: TimeUniforms, capacity: number, renderOrder: number) {
    const geometry = new InstancedBufferGeometry()
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
    )
    geometry.setIndex([0, 1, 2, 0, 2, 3])
    this.ticks = new InstancedBufferAttribute(new Float32Array(capacity), 1)
    this.ends = new InstancedBufferAttribute(new Float32Array(capacity), 1)
    geometry.setAttribute('aTick', this.ticks)
    geometry.setAttribute('aEnd', this.ends)
    geometry.instanceCount = 0
    this.mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...time,
          uColor: { value: srgb('#7EE0C3') },
          uWidth: { value: 0.06 },
          uGlow: { value: 0.6 },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this.twin = new GlowTwin(this.mesh, 'emitter')
  }

  setStyle(on: boolean, color: string, width: number, glow: number): void {
    this.mesh.visible = on
    const { uniforms } = this.mesh.material
    if (uniforms.uColor) uniforms.uColor.value = srgb(color)
    if (uniforms.uWidth) uniforms.uWidth.value = width
    if (uniforms.uGlow) uniforms.uGlow.value = glow
    this.twin.enabled = on && glow > 0
  }

  /**
   * The lines to draw: the loop's start and end, then each repeat's (shifted by whole periods).
   * Rewrites the buffers only when they change.
   */
  place(lines: readonly { readonly tick: number; readonly end: boolean }[]): void {
    const count = Math.min(lines.length, this.ticks.count)
    const key = lines
      .slice(0, count)
      .map((l) => `${l.tick}${l.end ? 'e' : 's'}`)
      .join()
    if (key === this.key) return
    this.key = key
    const ticks = this.ticks.array as Float32Array
    const ends = this.ends.array as Float32Array
    for (let i = 0; i < count; i++) {
      const line = lines[i]
      if (line === undefined) continue
      ticks[i] = line.tick
      ends[i] = line.end ? 1 : 0
    }
    this.ticks.needsUpdate = true
    this.ends.needsUpdate = true
    this.mesh.geometry.instanceCount = count
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.twin.dispose()
  }
}
