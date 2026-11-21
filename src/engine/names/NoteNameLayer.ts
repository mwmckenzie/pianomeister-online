import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  type Texture,
} from 'three'

import { KEYBOARD } from '../model/KEYBOARD'
import type { NoteInstance } from '../model/NoteInstance'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { atlasCell } from './NoteLabelAtlas'

/** Smallest readable label height on screen, in CSS pixels (brief decision 114). */
export const MIN_LABEL_PX = 10

const VERTEX = /* glsl */ `
${TIME_GLSL}
uniform float uLift;
uniform float uBufferHeight;
uniform float uMinPx;
attribute vec2 aLane;   // left x, width
attribute vec3 aTicks;  // start, end, head end
attribute vec4 aCell;   // atlas u0, v0, u1, v1
varying vec2 vUv;
varying float vTick;

vec2 screen(vec3 p) {
  vec4 c = projectionMatrix * viewMatrix * vec4(p, 1.0);
  return c.xy / c.w * 0.5 * uBufferHeight;
}

void main() {
  float width = aLane.y * 0.85;
  // Elongated along the note like a road marking: seen at the camera's tilt it reads at about
  // the atlas cell's 2:1 shape instead of a few pixels tall.
  float depth = width * 2.0;
  float gap = 0.05 / uUnitsPerTick;
  float start = aTicks.z + gap;
  float end = start + depth / uUnitsPerTick;
  float x = aLane.x + 0.5 * aLane.y;
  vec3 near = vec3(x, uLift, tickToZ(start));
  vec3 far = vec3(x, uLift, tickToZ(end));
  // On the sustain right behind the head; none when the note is too short for the label, once
  // the label reaches the now line, beyond the haze, or while it is too small to read.
  float tall = distance(screen(near), screen(far));
  float shown = step(end, aTicks.y) * step(uTick, start) * step(start, uTick + 1.5 * uLookAheadTicks)
    * step(uMinPx, tall);
  float tick = mix(start, end, uv.y);
  vec3 world = vec3(x + position.x * width * shown, uLift, tickToZ(tick));
  vUv = mix(aCell.xy, aCell.zw, uv);
  vTick = tick;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform sampler2D uAtlas;
varying vec2 vUv;
varying float vTick;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float alpha = t.a * hazeAlpha(vTick);
  if (alpha <= 0.02) discard;
  gl_FragColor = vec4(t.rgb, alpha);
}
`

/** Note names on notes (brief decision 114), one instanced draw per lane colour. */
export class NoteNameLayer {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>

  constructor(
    notes: readonly NoteInstance[],
    time: TimeUniforms,
    atlas: Texture,
    renderOrder: number,
  ) {
    const g = new InstancedBufferGeometry()
    g.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 0, -0.5, 0, 0]), 3),
    )
    g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute(
      'aLane',
      new InstancedBufferAttribute(new Float32Array(notes.flatMap((n) => [n.x, n.width])), 2),
    )
    g.setAttribute(
      'aTicks',
      new InstancedBufferAttribute(
        new Float32Array(notes.flatMap((n) => [n.startTick, n.endTick, n.headEndTick])),
        3,
      ),
    )
    g.setAttribute(
      'aCell',
      new InstancedBufferAttribute(
        new Float32Array(notes.flatMap((n) => atlasCell(n.midi - KEYBOARD.lowest))),
        4,
      ),
    )
    g.instanceCount = notes.length
    this.mesh = new Mesh(
      g,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...time,
          uLift: { value: 0.012 },
          uBufferHeight: { value: 720 },
          uMinPx: { value: MIN_LABEL_PX },
          uAtlas: { value: atlas },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this.mesh.visible = false
  }

  setLift(y: number, onTop: boolean): void {
    this.uniform('uLift', y + 0.002)
    this.mesh.material.depthTest = !onTop
  }

  /** Drawing-buffer height and device pixel ratio, for the readable-size test. */
  setViewport(bufferHeight: number, pixelRatio: number): void {
    this.uniform('uBufferHeight', bufferHeight)
    this.uniform('uMinPx', MIN_LABEL_PX * pixelRatio)
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
