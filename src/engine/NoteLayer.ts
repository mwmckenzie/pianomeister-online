import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'

import type { NoteInstance } from './model/NoteInstance'
import { srgb } from './srgb'
import { TIME_GLSL } from './timeGlsl'
import type { TimeUniforms } from './TimeUniforms'

const VERTEX = /* glsl */ `
${TIME_GLSL}
attribute vec2 aLane;    // left x, width
attribute vec3 aTicks;   // start, end, head end
attribute vec3 aColor;
attribute float aLayer;  // 0 = white-key lane, 1 = black-key lane (drawn above)

varying float vU;
varying float vTick;
varying float vHeadEnd;
varying vec3 vColor;

void main() {
  // Clip the strip to what is visible: from the now line (notes shorten into the keys as they
  // play) to 1.5 look-aheads out. Fully outside, both ends meet and the quad has no area.
  float lo = max(aTicks.x, uTick);
  float hi = max(lo, min(aTicks.y, uTick + 1.5 * uLookAheadTicks));
  float tick = mix(lo, hi, position.y);
  vec3 world = vec3(aLane.x + (position.x + 0.5) * aLane.y, 0.01 + aLayer * 0.01, tickToZ(tick));
  vU = position.x * 2.0;
  vTick = tick;
  vHeadEnd = aTicks.z;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform float uCenterOpacity;
uniform float uEdgeOpacity;

varying float vU;
varying float vTick;
varying float vHeadEnd;
varying vec3 vColor;

void main() {
  // Varyings are perspective-correct, so vU is the note's own lane coordinate: the gradient
  // follows the strip's perspective and taper instead of the screen.
  float alpha = vTick < vHeadEnd ? 1.0 : mix(uCenterOpacity, uEdgeOpacity, abs(vU));
  alpha *= hazeAlpha(vTick);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`

/** All notes of a song as one instanced draw call; per frame only the shared uniforms change. */
export class NoteLayer {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>

  constructor(notes: readonly NoteInstance[], time: TimeUniforms) {
    const geometry = new InstancedBufferGeometry()
    // Unit strip: x across the lane (-0.5..0.5), y along time (0 = start, 1 = end).
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3),
    )
    geometry.setIndex([0, 1, 2, 0, 2, 3])
    const palette = PITCH_CLASS_COLORS.map((c) => srgb(c.hex))
    const lane = new Float32Array(notes.length * 2)
    const ticks = new Float32Array(notes.length * 3)
    const color = new Float32Array(notes.length * 3)
    const layer = new Float32Array(notes.length)
    notes.forEach((n, i) => {
      lane.set([n.x, n.width], i * 2)
      ticks.set([n.startTick, n.endTick, n.headEndTick], i * 3)
      const c = palette[n.colorIndex]
      color.set([c?.r ?? 1, c?.g ?? 1, c?.b ?? 1], i * 3)
      layer[i] = n.isBlack ? 1 : 0
    })
    geometry.setAttribute('aLane', new InstancedBufferAttribute(lane, 2))
    geometry.setAttribute('aTicks', new InstancedBufferAttribute(ticks, 3))
    geometry.setAttribute('aColor', new InstancedBufferAttribute(color, 3))
    geometry.setAttribute('aLayer', new InstancedBufferAttribute(layer, 1))
    geometry.instanceCount = notes.length

    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { ...time, uCenterOpacity: { value: 0.75 }, uEdgeOpacity: { value: 0.25 } },
      transparent: true,
      depthWrite: false,
    })
    this.mesh = new Mesh(geometry, material)
    // The shader places every vertex, so the geometry bounds mean nothing to the culler.
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
  }

  /** Transparency 0–1 at the lane centre and edges (opacity = 1 − transparency). */
  setSustainTransparency(center: number, edge: number): void {
    const uniforms = this.mesh.material.uniforms
    if (uniforms.uCenterOpacity) uniforms.uCenterOpacity.value = 1 - center
    if (uniforms.uEdgeOpacity) uniforms.uEdgeOpacity.value = 1 - edge
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
