import {
  BufferAttribute,
  Color,
  FrontSide,
  LessEqualDepth,
  type InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three'

import { buildBevelTemplate } from '../geometry/buildBevelTemplate'
import { GlowTwin } from '../GlowTwin'
import type { NoteInstance } from '../model/NoteInstance'
import { LIGHT_GLSL } from '../sceneLight'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { NOTE_FILL_GLSL } from './NOTE_FILL_GLSL'
import type { NoteColors } from '../NoteColors'
import { noteGeometry, recolorNotes } from './noteGeometry'
import type { NoteStyleUniforms } from './NoteStyleUniforms'

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
attribute float aVelocity;
attribute float aDeck;

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vColor;
varying float vTick;
varying vec3 vLocal;
varying vec3 vHalf;
varying float vStart;
varying float vEnd;
varying float vVelocity;
varying float vClipped;
varying float vSeed;
varying float vBand;

void main() {
  vBand = bandStrength(aDeck, aTicks.x);
  // The head spans its visible ticks: clipped at the now line, so it sinks into the key. A ridge
  // (a raised sustain) spans the rest of the note, from the head's end.
#ifdef RIDGE
  float lo = max(aTicks.z, uTick);
  float hi = max(lo, min(min(aTicks.y, uTick + 1.5 * uLookAheadTicks), uClipHi));
#else
  float lo = max(aTicks.x, uTick);
  float hi = max(lo, min(min(aTicks.z, uTick + 1.5 * uLookAheadTicks), uClipHi));
#endif
  // A note starting before the drawn range is left out (see uClipLo).
  hi = mix(lo, hi, step(uClipLo, aTicks.x));
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
  vLocal = world - center;
  vHalf = halfSize;
  vStart = aTicks.x;
  vEnd = aTicks.y;
  vVelocity = aVelocity;
#ifdef RIDGE
  vClipped = step(aTicks.z, uTick - 1e-3);
#else
  vClipped = step(aTicks.x, uTick - 1e-3);
#endif
  vSeed = fract(aLane.x * 0.137 + aTicks.x * 0.00071);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${TIME_GLSL}
${LIGHT_GLSL}
${NOTE_FILL_GLSL}
uniform float uSideShade;   // 0–1: how much darker the vertical faces are than the top
uniform float uOpacity;     // ridges: the top's opacity, the sustain's (heads: 1)
uniform vec3 uDimColor;     // outside the loop, blocks fade toward the highway's colour
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vColor;
varying float vTick;
varying vec3 vLocal;
varying vec3 vHalf;
varying float vStart;
varying float vEnd;
varying float vVelocity;
varying float vClipped;
varying float vSeed;
varying float vBand;

void main() {
  float haze = hazeAlpha(vTick);
  if (haze <= 0.002) discard;
#ifdef RIDGE
  float style = uSustainFill;
  Stripes st = Stripes(uSustainStripeA, uSustainStripeB, uSustainStripeOpacity, uSustainStripeShape);
#else
  float style = uHeadFill;
  Stripes st = Stripes(uHeadStripeA, uHeadStripeB, uHeadStripeOpacity, uHeadStripeShape);
#endif
  float along = (vTick - vStart) * uUnitsPerTick;
  float len = (vEnd - vStart) * uUnitsPerTick;
  float u = vLocal.x / max(vHalf.x, 1e-4);
  // Edges of the block: where two of the three faces are close. The near face is no edge while
  // the head is cut at the now line.
  vec3 d = vHalf - abs(vLocal);
  if (vClipped > 0.5 && vLocal.z > 0.0) d.z = 1e3;
  float lo = min(d.x, min(d.y, d.z));
  float hi = max(d.x, max(d.y, d.z));
  float second = d.x + d.y + d.z - lo - hi;
  Fill f = noteFill(style, vColor, u, vHalf.x, along, len, vSeed, second, st);
  float rim = noteEdge(second, style);
  float pulse = notePulse(vStart, vVelocity);
  float sounding = noteSounding(vStart, vEnd);
  vec3 rimColor = mix(vColor, vec3(1.0), 0.35);
#ifdef GLOW_PASS
  // An occluder on the glow layer: black, except what glows.
  float glow = (rim * uEdgeIntensity + f.emission + sounding + pulse) * haze;
  glow *= (1.0 - loopDim(vTick)) * vBand;
  gl_FragColor = vec4(mix(glowColor(f), rimColor, rim) * glow, 1.0);
#else
  vec3 n = normalize(vNormal);
  vec3 color = shade(f.color, n, normalize(cameraPosition - vWorld));
  if (rim > 0.0) color = mix(color, rimColor, rim);
  if (sounding > 0.0) color += vColor * sounding;
  if (pulse > 0.0) color += mix(vColor, vec3(1.0), 0.5) * pulse;
  // Darker vertical faces read as a solid block even where shadows and outlines are lost.
  float side = 1.0 - clamp(n.y, 0.0, 1.0);
  color *= 1.0 - uSideShade * side;
  // A ridge's top takes the sustain's transparency; its sides are opaque, so it reads as a block.
  float alpha = f.alpha * mix(uOpacity, 1.0, step(0.5, side));
  // Dimmed like an overlay in the highway's colour (opaque blocks: mix, not fade).
  color = mix(color, uDimColor, loopDim(vTick));
  // The ending song in the crossfade band fades toward the highway's colour, like its audio.
  color = mix(uDimColor, color, vBand);
  gl_FragColor = vec4(color, haze * alpha);
#endif
}
`

/**
 * 3D note heads (brief decision 39): raised blocks with the head's footprint, lit by the scene
 * light, rounded or square edges from a bevel template, with the milestone 9 head fill, rims,
 * pulse and sounding glow. Transparent only for the haze (and see-through fills); they
 * write depth and cull back faces, so each convex block draws correctly in one pass.
 */
export class HeadLayer {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>
  /** On the glow layer the blocks occlude what's behind them. */
  readonly twin: GlowTwin<InstancedBufferGeometry>
  private readonly notes: readonly NoteInstance[]

  constructor(
    notes: readonly NoteInstance[],
    time: TimeUniforms,
    style: NoteStyleUniforms,
    renderOrder: number,
    private readonly colors: NoteColors,
    /** A raised sustain (from the head's end to the note's end) instead of the head. */
    private readonly ridge = false,
  ) {
    // Far to near: translucent heads (haze, see-through fills) blend over the farther ones.
    this.notes = [...notes].sort((a, b) => b.startTick - a.startTick)
    this.mesh = new Mesh(
      noteGeometry(this.notes, shape(true), colors),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...time,
          ...style,
          uLift: { value: 0.01 },
          uHeight: { value: 0.35 },
          uRadius: { value: HEAD_EDGE_RADIUS },
          uSideShade: { value: 0 },
          uOpacity: { value: 1 },
          uDimColor: { value: new Color(0, 0, 0) },
        },
        defines: ridge ? { RIDGE: '' } : {},
        transparent: true,
        depthWrite: true,
        side: FrontSide,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this.twin = new GlowTwin(this.mesh, 'occluder')
  }

  /**
   * Heads are depth-tested and write depth, white and black alike, so a nearer note always
   * covers a farther one whatever its colour. `winsTies` (black-lane notes) adds a small depth
   * bias toward the camera: where a black and a white block share a face (a chord's front
   * faces, side by side on the highway) the black one shows, with no z-fighting. The bias is far
   * smaller than the gap between different notes, so it never lifts a farther block over a
   * nearer one.
   */
  setLift(y: number, winsTies = false): void {
    this.uniform('uLift', y)
    biasToward(this.mesh.material, winsTies)
  }

  /** How much darker the vertical faces are than the top, 0–1. */
  setSideShading(amount: number): void {
    this.uniform('uSideShade', amount)
  }

  /** The colour dimmed blocks fade toward (the highway's), outside the loop. */
  setDimColor(color: Color): void {
    const u = this.mesh.material.uniforms.uDimColor
    if (u) u.value = color
  }

  /** Ridges: the top's opacity (the sustain's); the sides stay opaque. */
  setTopOpacity(opacity: number): void {
    this.uniform('uOpacity', opacity)
  }

  /** Takes the palette's current colours (after a change of note colours). */
  recolor(): void {
    recolorNotes(this.mesh.geometry, this.notes, this.colors)
  }

  setShape(height: number, roundedEdges: boolean): void {
    // Ridges keep square ends (milestone 9.2): a lower, unrounded head.
    const rounded = roundedEdges && !this.ridge
    this.uniform('uHeight', height)
    const wasRounded = this.mesh.geometry.getAttribute('aOffset').count === shapeCount(true)
    if (wasRounded !== rounded) {
      const old = this.mesh.geometry
      this.mesh.geometry = noteGeometry(this.notes, shape(rounded), this.colors)
      old.dispose()
    }
    this.uniform('uRadius', rounded ? HEAD_EDGE_RADIUS : 0)
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

/** A depth bias toward the camera for layers that win coplanar ties (black-lane notes). */
export function biasToward(material: ShaderMaterial, on: boolean): void {
  material.depthTest = true
  material.depthFunc = LessEqualDepth
  material.polygonOffset = on
  material.polygonOffsetFactor = on ? -1 : 0
  material.polygonOffsetUnits = on ? -4 : 0
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
