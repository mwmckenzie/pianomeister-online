import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three'

import { KEYBOARD } from './model/KEYBOARD'
import { mergeSpans } from './model/mergeSpans'
import { srgb } from './srgb'
import { TIME_GLSL } from './timeGlsl'
import type { TimeUniforms } from './TimeUniforms'

const VERTEX = /* glsl */ `
${TIME_GLSL}
attribute vec2 aSpan; // start tick, end tick
varying float vTick;
void main() {
  float lo = max(aSpan.x, uTick);
  float hi = max(lo, min(aSpan.y, uTick + 1.5 * uLookAheadTicks));
  float tick = mix(lo, hi, position.y);
  vTick = tick;
  // Just above the surface, under lane lines and notes.
  vec3 world = vec3(position.x * ${KEYBOARD.width.toFixed(1)}, 0.003, tickToZ(tick));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform vec3 uColor;
uniform float uOpacity;
varying float vTick;
void main() {
  float alpha = uOpacity * hazeAlpha(vTick);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`

/** Full-width bands under the notes while the sustain pedal is down (assigned channels, merged). */
export class PedalBands {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>

  constructor(
    intervals: readonly { readonly startTick: number; readonly endTick: number }[],
    time: TimeUniforms,
  ) {
    const spans = mergeSpans(intervals)
    const geometry = new InstancedBufferGeometry()
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
    )
    geometry.setIndex([0, 1, 2, 0, 2, 3])
    geometry.setAttribute(
      'aSpan',
      new InstancedBufferAttribute(
        new Float32Array(spans.flatMap((s) => [s.startTick, s.endTick])),
        2,
      ),
    )
    geometry.instanceCount = spans.length
    this.mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { ...time, uColor: { value: srgb('#4A5468') }, uOpacity: { value: 0.22 } },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
  }

  setStyle(color: string, opacity: number): void {
    const { uColor, uOpacity } = this.mesh.material.uniforms
    if (uColor) uColor.value = srgb(color)
    if (uOpacity) uOpacity.value = opacity
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
