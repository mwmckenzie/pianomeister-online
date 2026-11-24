import { type InstancedBufferGeometry, Mesh, ShaderMaterial } from 'three'

import { GlowTwin } from '../GlowTwin'
import type { NoteInstance } from '../model/NoteInstance'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { NOTE_FILL_GLSL } from './NOTE_FILL_GLSL'
import type { NoteColors } from '../NoteColors'
import { noteGeometry, recolorNotes } from './noteGeometry'
import { biasToward } from './HeadLayer'
import type { NoteStyleUniforms } from './NoteStyleUniforms'

const VERTEX = /* glsl */ `
${TIME_GLSL}
uniform float uLift;
uniform float uFlatHeads; // 1 = draw heads here as flat strips (3D heads off)
attribute vec2 aLane;    // left x, width
attribute vec3 aTicks;   // start, end, head end
attribute vec3 aColor;
attribute float aVelocity;
attribute float aDeck;

varying float vU;
varying float vTick;
varying float vHeadEnd;
varying vec3 vColor;
varying float vStart;
varying float vEnd;
varying float vVelocity;
varying float vHalfWidth;
varying float vStartOpen;
varying float vSeed;
varying float vBand;

void main() {
  vBand = bandStrength(aDeck, aTicks.x);
  // Clip the strip to what is visible: from the now line (notes shorten into the keys as they
  // play) to 1.5 look-aheads out. With 3D heads the strip starts where the head block ends.
  float start = mix(aTicks.z, aTicks.x, uFlatHeads);
  float lo = max(start, uTick);
  float hi = max(lo, min(min(aTicks.y, uTick + 1.5 * uLookAheadTicks), uClipHi));
  // A note starting before the drawn range is left out (see uClipLo).
  hi = mix(lo, hi, step(uClipLo, aTicks.x));
  float tick = mix(lo, hi, position.y);
  vec3 world = vec3(aLane.x + (position.x + 0.5) * aLane.y, uLift, tickToZ(tick));
  vU = position.x * 2.0;
  vTick = tick;
  vHeadEnd = mix(-1e9, aTicks.z, uFlatHeads);
  vColor = aColor;
  vStart = aTicks.x;
  vEnd = aTicks.y;
  vVelocity = aVelocity;
  vHalfWidth = 0.5 * aLane.y;
  // No rim where the strip meets the 3D head or is cut at the now line.
  vStartOpen = max(1.0 - uFlatHeads, step(start, uTick - 1e-3));
  vSeed = fract(aLane.x * 0.137 + aTicks.x * 0.00071);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
${NOTE_FILL_GLSL}
uniform float uCenterOpacity;
uniform float uEdgeOpacity;

varying float vU;
varying float vTick;
varying float vHeadEnd;
varying vec3 vColor;
varying float vStart;
varying float vEnd;
varying float vVelocity;
varying float vHalfWidth;
varying float vStartOpen;
varying float vSeed;
varying float vBand;

void main() {
  // Varyings are perspective-correct, so vU is the note's own lane coordinate: the gradient
  // follows the strip's perspective and taper instead of the screen.
  bool head = vTick < vHeadEnd;
  // The note's own opacity (the centre setting): glow and additive parts scale with it, so a
  // see-through note never keeps its full halo.
  float opacity = head ? 1.0 : uCenterOpacity;
  float base = head ? 1.0 : mix(uCenterOpacity, uEdgeOpacity, abs(vU));
  float haze = hazeAlpha(vTick);
  float style = head ? uHeadFill : uSustainFill;
  float along = (vTick - vStart) * uUnitsPerTick;
  float len = (vEnd - vStart) * uUnitsPerTick;
  float side = (1.0 - abs(vU)) * vHalfWidth;
  float startEdge = mix(along, 1e3, vStartOpen);
  float edge = min(side, min(startEdge, len - along));
  // (No ?: on structs in WebGL's GLSL.)
  Stripes st = Stripes(uSustainStripeA, uSustainStripeB, uSustainStripeOpacity, uSustainStripeShape);
  if (head) st = Stripes(uHeadStripeA, uHeadStripeB, uHeadStripeOpacity, uHeadStripeShape);
  Fill f = noteFill(style, vColor, vU, vHalfWidth, along, len, vSeed, edge, st);
  float rim = noteEdge(edge, style);
  float pulse = notePulse(vStart, vVelocity);
  float sounding = noteSounding(vStart, vEnd);
  vec3 rimColor = mix(vColor, vec3(1.0), 0.35);
  float lit = mix(opacity, 1.0, f.keep);
#ifdef GLOW_PASS
  float glow = (rim * uEdgeIntensity + (f.emission + sounding + pulse) * f.alpha) * lit;
  float dim = (1.0 - loopDim(vTick)) * vBand;
  glow *= haze * dim;
  if (glow <= 0.002) discard;
  gl_FragColor = vec4(mix(glowColor(f), rimColor, rim) * glow, 1.0);
#else
  float alpha = mix(base, 1.0, f.keep) * f.alpha;
  vec3 color = f.color;
  if (rim > 0.0) {
    color = mix(color, rimColor, rim);
    alpha = max(alpha, rim * opacity);
  }
  if (sounding > 0.0) {
    color += vColor * sounding;
    alpha = min(1.0, alpha + 0.3 * sounding * opacity);
  }
  if (pulse > 0.0) {
    color += mix(vColor, vec3(1.0), 0.5) * pulse;
    alpha = min(1.0, alpha + pulse * opacity);
  }
  alpha *= haze * (1.0 - loopDim(vTick)) * vBand;
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(color, alpha);
#endif
}
`

/**
 * Flat, translucent note sustains (brief decision 19) for one lane colour (white or black), as
 * one instanced draw, with the milestone 9 fill styles, rims, pulse and sounding glow. Black-lane
 * sustains float at the black lift. With 3D heads off it also draws the heads, as flat strips.
 */
export class SustainLayer {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>
  readonly twin: GlowTwin<InstancedBufferGeometry>
  private readonly notes: readonly NoteInstance[]

  constructor(
    notes: readonly NoteInstance[],
    time: TimeUniforms,
    style: NoteStyleUniforms,
    renderOrder: number,
    private readonly colors: NoteColors,
  ) {
    this.notes = notes
    this.mesh = new Mesh(
      noteGeometry(notes, undefined, colors),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...time,
          ...style,
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
    this.twin = new GlowTwin(this.mesh, 'emitter')
  }

  /**
   * Depth-tested (nearer heads cover the strips) without writing depth. `winsTies` (black-lane
   * sustains, a hair above the white ones): a depth bias, so where the strips overlap on the
   * highway the black one shows (see HeadLayer.setLift).
   */
  setLift(y: number, winsTies = false): void {
    this.uniform('uLift', y)
    biasToward(this.mesh.material, winsTies)
  }

  /** Takes the palette's current colours (after a change of note colours). */
  recolor(): void {
    recolorNotes(this.mesh.geometry, this.notes, this.colors)
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
    this.twin.dispose()
  }

  private uniform(name: string, value: number): void {
    const u = this.mesh.material.uniforms[name]
    if (u) u.value = value
  }
}
