import { type InstancedBufferGeometry, Mesh, ShaderMaterial } from 'three'

import type { NoteInstance } from '../model/NoteInstance'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { noteGeometry } from './noteGeometry'

/** How far the soft edge reaches beyond the note, in world units. */
const SOFT_EDGE = 0.22

const VERTEX = /* glsl */ `
${TIME_GLSL}
uniform float uLift;
attribute vec2 aLane;
attribute vec3 aTicks;
varying vec2 vLocal;   // world-unit offset from the note's centre (x, z)
varying vec2 vHalf;    // the note's half size (x, z)
varying float vTick;

void main() {
  float lo = max(aTicks.x, uTick);
  float hi = max(lo, min(aTicks.y, uTick + 1.5 * uLookAheadTicks));
  float zNear = tickToZ(lo);
  float zFar = tickToZ(hi);
  vec2 halfSize = vec2(aLane.y, zNear - zFar) * 0.5;
  // A note that isn't visible casts nothing: collapse its quad.
  float shown = step(0.0001, halfSize.y);
  vec2 extent = (halfSize + ${SOFT_EDGE.toFixed(3)}) * shown;
  // Cast slightly away from the light (which comes from the right and the player's side), more
  // the higher the note floats.
  vec2 center = vec2(aLane.x + halfSize.x - 0.08 * uLift, zFar + halfSize.y - 0.12 * uLift);
  vec2 local = vec2(position.x * 2.0, position.y * 2.0 - 1.0) * extent;
  vLocal = local;
  vHalf = halfSize;
  vec3 world = vec3(center.x + local.x, 0.02, center.y - local.y);
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
  // Distance outside the note's footprint, softened over the edge width.
  vec2 q = abs(vLocal) - vHalf;
  float d = length(max(q, 0.0)) / ${SOFT_EDGE.toFixed(3)};
  float alpha = uStrength * (1.0 - smoothstep(0.0, 1.0, d)) * hazeAlpha(vTick);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`

/**
 * A faked soft contact shadow under black-lane notes (brief decision 41). Drawn after the
 * white-lane notes and before the black-lane notes, without depth testing, so it darkens the
 * highway and the neighbouring white notes but never the black note itself. No shadow maps.
 */
export class ContactShadow {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>

  constructor(blackNotes: readonly NoteInstance[], time: TimeUniforms, renderOrder: number) {
    this.mesh = new Mesh(
      noteGeometry(blackNotes),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { ...time, uLift: { value: 0.5 }, uStrength: { value: 0.45 } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
  }

  set(enabled: boolean, strength: number, lift: number): void {
    this.mesh.visible = enabled && strength > 0
    const { uniforms } = this.mesh.material
    if (uniforms.uStrength) uniforms.uStrength.value = strength
    if (uniforms.uLift) uniforms.uLift.value = lift
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
