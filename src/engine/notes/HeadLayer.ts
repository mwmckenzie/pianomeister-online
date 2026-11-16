import {
  AlwaysDepth,
  BufferAttribute,
  FrontSide,
  LessEqualDepth,
  type InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three'

import { buildBevelTemplate } from '../geometry/buildBevelTemplate'
import type { NoteInstance } from '../model/NoteInstance'
import { LIGHT_GLSL } from '../sceneLight'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { noteGeometry } from './noteGeometry'

/** Rounded-edge radius of 3D heads, in world units (brief decision 39). */
const HEAD_EDGE_RADIUS = 0.06

const VERTEX = /* glsl */ `
${TIME_GLSL}
uniform float uLift;
uniform float uHeight;
uniform float uRadius;
attribute vec3 aOffset;  // bevel template: position holds the ±1 corner
attribute vec2 aLane;
attribute vec3 aTicks;
attribute vec3 aColor;

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vColor;
varying float vTick;

void main() {
  // The head spans its visible ticks: clipped at the now line, so it sinks into the key.
  float lo = max(aTicks.x, uTick);
  float hi = max(lo, min(aTicks.z, uTick + 1.5 * uLookAheadTicks));
  float zNear = tickToZ(lo);
  float zFar = tickToZ(hi);
  // A head with no visible length (already played, or not yet in view) collapses entirely;
  // otherwise it would leave a zero-depth wall of full width and height standing at the edge.
  float shown = step(1e-4, zNear - zFar);
  vec3 halfSize = vec3(aLane.y, uHeight, zNear - zFar) * 0.5 * shown;
  // A constant world-size bevel, never stretched with the head (at most 40% of a side).
  float r = min(uRadius, 0.8 * min(halfSize.x, min(halfSize.y, halfSize.z)));
  vec3 center = vec3(aLane.x + halfSize.x, uLift + halfSize.y, zFar + halfSize.z);
  vec3 world = center + position * (halfSize - r) + aOffset * r;
  vNormal = normal;
  vWorld = world;
  vColor = aColor;
  vTick = zToTick(world.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
${LIGHT_GLSL}
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vColor;
varying float vTick;

void main() {
  float alpha = hazeAlpha(vTick);
  if (alpha <= 0.002) discard;
  vec3 color = shade(vColor, normalize(vNormal), normalize(cameraPosition - vWorld));
  gl_FragColor = vec4(color, alpha);
}
`

/**
 * 3D note heads (brief decision 39): raised blocks with the head's footprint, lit by the scene
 * light, rounded or square edges from a bevel template. Transparent only for the haze; they
 * write depth and cull back faces, so each convex block draws correctly in one pass.
 */
export class HeadLayer {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>
  private readonly notes: readonly NoteInstance[]

  constructor(notes: readonly NoteInstance[], time: TimeUniforms, renderOrder: number) {
    // Far to near: when drawn on top without depth testing (see setLift), nearer heads must
    // land last to overlap farther ones correctly.
    this.notes = [...notes].sort((a, b) => b.startTick - a.startTick)
    this.mesh = new Mesh(
      noteGeometry(this.notes, shape(true)),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...time,
          uLift: { value: 0.01 },
          uHeight: { value: 0.35 },
          uRadius: { value: HEAD_EDGE_RADIUS },
        },
        transparent: true,
        depthWrite: true,
        side: FrontSide,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
  }

  /**
   * `onTop`: draw over everything already drawn (the white-lane notes) instead of depth
   * testing. Used for black-lane heads when they float lower than the white heads' tops, where
   * the blocks would otherwise intersect and z-fight; black-lane heads always win.
   */
  setLift(y: number, onTop = false): void {
    this.uniform('uLift', y)
    this.mesh.material.depthFunc = onTop ? AlwaysDepth : LessEqualDepth
  }

  setShape(height: number, rounded: boolean): void {
    this.uniform('uHeight', height)
    const wasRounded = this.mesh.geometry.getAttribute('aOffset').count === shapeCount(true)
    if (wasRounded !== rounded) {
      const old = this.mesh.geometry
      this.mesh.geometry = noteGeometry(this.notes, shape(rounded))
      old.dispose()
    }
    this.uniform('uRadius', rounded ? HEAD_EDGE_RADIUS : 0)
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

function shape(rounded: boolean): Record<string, BufferAttribute> {
  const t = buildBevelTemplate(rounded ? 'rounded' : 'none')
  return {
    position: new BufferAttribute(t.corner.slice(), 3),
    aOffset: new BufferAttribute(t.offset.slice(), 3),
    normal: new BufferAttribute(t.normal.slice(), 3),
  }
}

function shapeCount(rounded: boolean): number {
  return buildBevelTemplate(rounded ? 'rounded' : 'none').vertexCount
}
