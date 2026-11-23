import { type InstancedBufferGeometry, Mesh, ShaderMaterial } from 'three'

import type { NoteInstance } from '../model/NoteInstance'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { noteGeometry } from './noteGeometry'

/** How far the rim reaches beyond the note on every side, in world units. */
const RIM = 0.08

const VERTEX = /* glsl */ `
${TIME_GLSL}
attribute vec2 aLane;
attribute vec3 aTicks;
varying vec2 vLocal;   // world-unit offset from the note's centre (x, z)
varying vec2 vHalf;    // the note's half size (x, z)
varying float vTick;

void main() {
  float lo = max(aTicks.x, uTick);
  float hi = max(lo, min(min(aTicks.y, uTick + 1.5 * uLookAheadTicks), uClipHi));
  hi = mix(lo, hi, step(uClipLo, aTicks.x));
  float zNear = tickToZ(lo);
  float zFar = tickToZ(hi);
  vec2 halfSize = vec2(aLane.y, zNear - zFar) * 0.5;
  // A note that isn't visible has no outline: collapse its quad.
  float shown = step(0.0001, halfSize.y);
  vec2 extent = (halfSize + ${RIM.toFixed(3)}) * shown;
  // Centred on the note: the rim is the same width on every side (not a cast shadow).
  vec2 center = vec2(aLane.x + halfSize.x, zFar + halfSize.y);
  vec2 local = vec2(position.x * 2.0, position.y * 2.0 - 1.0) * extent;
  vLocal = local;
  vHalf = halfSize;
  vec3 world = vec3(center.x + local.x, 0.011, center.y - local.y);
  vTick = zToTick(world.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform float uStrength;
varying vec2 vLocal;
varying vec2 vHalf;
varying float vTick;

void main() {
  // Distance outside the note's footprint, in rim widths: solid for most of the rim, then a
  // short soft edge, so it reads as a thin dark line, not a haze.
  vec2 q = abs(vLocal) - vHalf;
  float d = length(max(q, 0.0)) / ${RIM.toFixed(3)};
  float alpha = uStrength * (1.0 - smoothstep(0.55, 1.0, d)) * hazeAlpha(vTick);
  alpha *= 1.0 - loopDim(vTick);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`

/**
 * The black note outline (brief decision 41, milestone 9.2): a thin dark rim the same width on
 * every side of each black-lane note, on the highway. Drawn after the white-lane notes and before
 * the black-lane notes, depth-tested: it darkens the highway and the white sustains beside and
 * under a black note, never the black note itself, and nearer white heads cover it. No shadow
 * maps.
 */
export class BlackOutline {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>

  constructor(blackNotes: readonly NoteInstance[], time: TimeUniforms, renderOrder: number) {
    this.mesh = new Mesh(
      noteGeometry(blackNotes),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { ...time, uStrength: { value: 0.8 } },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
  }

  set(enabled: boolean, strength: number): void {
    this.mesh.visible = enabled && strength > 0
    const { uniforms } = this.mesh.material
    if (uniforms.uStrength) uniforms.uStrength.value = strength
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
