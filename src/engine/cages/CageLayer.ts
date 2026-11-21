import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three'

import { GlowTwin } from '../GlowTwin'
import { cageQuads } from '../model/cageQuads'
import type { CageRegion } from '../model/CageRegion'
import { FILL_ID } from '../notes/noteStyle'
import { NOTE_FILL_GLSL } from '../notes/NOTE_FILL_GLSL'
import type { NoteStyleUniforms } from '../notes/NoteStyleUniforms'
import { srgb } from '../srgb'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import type { CageStyle } from './CageStyle'

const VERTEX = /* glsl */ `
${TIME_GLSL}
uniform float uY;
attribute vec4 aRect;  // x0, x1, start tick, end tick
attribute vec2 aOpen;  // start open, end open
varying float vX;
varying float vWidth;
varying float vTick;
varying float vStart;
varying float vEnd;
varying float vStartEdge;
varying float vEndEdge;
void main() {
  float lo = max(aRect.z, uTick);
  float hi = max(lo, min(aRect.w, uTick + 1.5 * uLookAheadTicks));
  float tick = mix(lo, hi, position.y);
  float x = mix(aRect.x, aRect.y, position.x);
  vX = x - aRect.x;
  vWidth = aRect.y - aRect.x;
  vTick = tick;
  vStart = aRect.z;
  vEnd = aRect.w;
  // No border where the cage is cut at the now line or joins the next region.
  vStartEdge = (1.0 - aOpen.x) * step(uTick, aRect.z);
  vEndEdge = 1.0 - aOpen.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(x, uY, tickToZ(tick), 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
${NOTE_FILL_GLSL}
uniform float uCageFill;
uniform vec3 uFillColor;
uniform float uFillOpacity;
uniform float uBorderOn;
uniform vec3 uBorderColor;
uniform float uBorderWidth;
uniform float uBorderGlow;
uniform float uRadius;
varying float vX;
varying float vWidth;
varying float vTick;
varying float vStart;
varying float vEnd;
varying float vStartEdge;
varying float vEndEdge;
void main() {
  float haze = hazeAlpha(vTick);
  float along = (vTick - vStart) * uUnitsPerTick;
  float len = (vEnd - vStart) * uUnitsPerTick;
  // Distance inside the cage's outline (world units), rounded at the corners.
  float dx = min(vX, vWidth - vX);
  float dz = min(mix(1e3, along, vStartEdge), mix(1e3, len - along, vEndEdge));
  float inside = min(dx, dz);
  float shape = 1.0;
  if (uRadius > 0.0 && dx < uRadius && dz < uRadius) {
    inside = uRadius - length(vec2(uRadius - dx, uRadius - dz));
    float pixel = max(fwidth(inside), 1e-5);
    shape = smoothstep(-pixel, pixel, inside);
  }
  float border = 0.0;
  if (uBorderOn > 0.5) {
    float pixel = max(fwidth(inside), 1e-5);
    border = 1.0 - smoothstep(uBorderWidth - pixel, uBorderWidth + pixel, inside);
  }
  float u = vX / max(vWidth, 1e-4) * 2.0 - 1.0;
  Fill f = noteFill(uCageFill, uFillColor, u, 0.5 * vWidth, along, len, 0.0);
  float fillAlpha = uFillOpacity * f.alpha;
#ifdef GLOW_PASS
  float glow = (border * uBorderGlow + f.emission * fillAlpha) * shape * haze;
  if (glow <= 0.002) discard;
  gl_FragColor = vec4(mix(f.color, uBorderColor, border) * glow, 1.0);
#else
  vec3 color = mix(f.color, uBorderColor, border);
  float alpha = max(fillAlpha, border) * shape;
  alpha *= haze;
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(color, alpha);
#endif
}
`

/**
 * Regions on the highway with a border and a fill (brief decision 115), drawn just above the
 * surface and under the lines and notes: the pedal cage now, milestone 10's hand cages later
 * (one layer per hand, regions replaced per song or setting with setRegions).
 */
export class CageLayer {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>
  readonly twin: GlowTwin<InstancedBufferGeometry>

  constructor(
    regions: readonly CageRegion[],
    time: TimeUniforms,
    style: NoteStyleUniforms,
    options: { readonly y: number; readonly renderOrder: number },
  ) {
    this.mesh = new Mesh(
      geometry(regions),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...time,
          ...style,
          uY: { value: options.y },
          uCageFill: { value: 0 },
          uFillColor: { value: srgb('#4A5468') },
          uFillOpacity: { value: 0.22 },
          uBorderOn: { value: 0 },
          uBorderColor: { value: srgb('#FFFFFF') },
          uBorderWidth: { value: 0.06 },
          uBorderGlow: { value: 0 },
          uRadius: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = options.renderOrder
    this.twin = new GlowTwin(this.mesh, 'emitter')
  }

  /** Replaces the regions (cheap: one instance buffer). */
  setRegions(regions: readonly CageRegion[]): void {
    const old = this.mesh.geometry
    this.mesh.geometry = geometry(regions)
    old.dispose()
  }

  setStyle(style: CageStyle): void {
    const u = this.mesh.material.uniforms
    const set = (name: string, value: unknown) => {
      const uniform = u[name]
      if (uniform) uniform.value = value
    }
    set('uCageFill', FILL_ID[style.fill])
    set('uFillColor', srgb(style.fillColor))
    set('uFillOpacity', style.fillOpacity)
    set('uBorderOn', style.border ? 1 : 0)
    set('uBorderColor', srgb(style.borderColor))
    set('uBorderWidth', style.borderWidth)
    set('uBorderGlow', style.borderGlow)
    set('uRadius', style.cornerRadius)
    const emissiveFill = style.fill === 'hotCore'
    this.twin.enabled = (style.border && style.borderGlow > 0) || emissiveFill
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.twin.dispose()
  }
}

function geometry(regions: readonly CageRegion[]): InstancedBufferGeometry {
  const quads = cageQuads(regions)
  const g = new InstancedBufferGeometry()
  g.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
  )
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.setAttribute(
    'aRect',
    new InstancedBufferAttribute(
      new Float32Array(quads.flatMap((q) => [q.x0, q.x1, q.startTick, q.endTick])),
      4,
    ),
  )
  g.setAttribute(
    'aOpen',
    new InstancedBufferAttribute(
      new Float32Array(quads.flatMap((q) => [q.openStart ? 1 : 0, q.openEnd ? 1 : 0])),
      2,
    ),
  )
  g.instanceCount = quads.length
  return g
}
