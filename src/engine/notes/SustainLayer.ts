import { type InstancedBufferGeometry, Mesh, ShaderMaterial } from 'three'

import type { NoteInstance } from '../model/NoteInstance'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { noteGeometry } from './noteGeometry'

const VERTEX = /* glsl */ `
${TIME_GLSL}
uniform float uLift;
uniform float uFlatHeads; // 1 = draw heads here as flat strips (3D heads off)
attribute vec2 aLane;    // left x, width
attribute vec3 aTicks;   // start, end, head end
attribute vec3 aColor;

varying float vU;
varying float vTick;
varying float vHeadEnd;
varying vec3 vColor;

void main() {
  // Clip the strip to what is visible: from the now line (notes shorten into the keys as they
  // play) to 1.5 look-aheads out. With 3D heads the strip starts where the head block ends.
  float start = mix(aTicks.z, aTicks.x, uFlatHeads);
  float lo = max(start, uTick);
  float hi = max(lo, min(aTicks.y, uTick + 1.5 * uLookAheadTicks));
  float tick = mix(lo, hi, position.y);
  vec3 world = vec3(aLane.x + (position.x + 0.5) * aLane.y, uLift, tickToZ(tick));
  vU = position.x * 2.0;
  vTick = tick;
  vHeadEnd = mix(-1e9, aTicks.z, uFlatHeads);
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

/**
 * Flat, translucent note sustains (brief decision 19) for one lane colour (white or black), as
 * one instanced draw. Black-lane sustains float at the black lift. With 3D heads off it also
 * draws the heads, as flat solid strips.
 */
export class SustainLayer {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>

  constructor(notes: readonly NoteInstance[], time: TimeUniforms, renderOrder: number) {
    this.mesh = new Mesh(
      noteGeometry(notes),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...time,
          uLift: { value: 0.01 },
          uFlatHeads: { value: 0 },
          uCenterOpacity: { value: 0.75 },
          uEdgeOpacity: { value: 0.25 },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    // The shader places every vertex, so the geometry bounds mean nothing to the culler.
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
  }

  /** `onTop`: skip the depth test so the strips draw over the white-lane heads (see HeadLayer). */
  setLift(y: number, onTop = false): void {
    this.uniform('uLift', y)
    this.mesh.material.depthTest = !onTop
  }

  setFlatHeads(flat: boolean): void {
    this.uniform('uFlatHeads', flat ? 1 : 0)
  }

  /** Transparency 0–1 at the lane centre and edges (opacity = 1 − transparency). */
  setSustainTransparency(center: number, edge: number): void {
    this.uniform('uCenterOpacity', 1 - center)
    this.uniform('uEdgeOpacity', 1 - edge)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }

  private uniform(name: string, value: number): void {
    const u = this.mesh.material.uniforms[name]
    if (u) u.value = value
  }
}
