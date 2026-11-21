import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'

import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { GlowTwin } from './GlowTwin'
import { NowLine } from './lines/NowLine'
import { keyLayout } from './model/keyLayout'
import { KEYBOARD } from './model/KEYBOARD'
import { type BoundaryKind, laneBoundaries } from './model/laneBoundaries'
import { lineColor } from './model/lineColor'
import { srgb } from './srgb'
import { TIME_GLSL } from './timeGlsl'
import type { TimeUniforms } from './TimeUniforms'

/** Far enough for the longest visible highway (cameraFit caps it at 300). */
const SURFACE_LENGTH = 320
const BAR_THICKNESS = 0.16
const BEAT_THICKNESS = 0.08
const LANE_THICKNESS = 0.03
/**
 * Thin lines are drawn on wider quads and cut to their true width in the fragment shader, with
 * an edge one screen pixel soft (fwidth). Far away, where a line is thinner than a pixel, it
 * fades instead of breaking up into dashes (the "grainy" look). The margin keeps at least a
 * pixel of quad around a line even at the far end of the highway.
 */
const LINE_MARGIN = 0.25
/** Half width of a glowing line's quad: room for the widest line (0.3) and its halo. */
const GLOW_LINE_HALF = 0.75

/** Coverage of a line of world width `width` at signed world distance `d` from its centre. */
const LINE_AA_GLSL = /* glsl */ `
float lineCoverage(float d, float width) {
  float pixel = max(fwidth(d), 1e-5);
  float edge = clamp((0.5 * width - abs(d)) / pixel + 0.5, 0.0, 1.0);
  // A line narrower than a pixel keeps its average brightness by fading, not by aliasing.
  return edge * min(1.0, width / pixel);
}
`

/** A static mesh on the highway whose fragments fade by their distance in ticks. */
const STATIC_VERTEX = /* glsl */ `
attribute float aAcross;
varying float vZ;
varying float vAcross;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vZ = world.z;
  vAcross = aAcross;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const SURFACE_FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform vec3 uColor;
uniform vec3 uFadeTo;
varying float vZ;
void main() {
  // The surface melts into the background through the same haze as the notes.
  gl_FragColor = vec4(mix(uFadeTo, uColor, hazeAlpha(zToTick(vZ))), 1.0);
}
`

const SHADE_FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform float uStrength;
varying float vZ;
void main() {
  float alpha = uStrength * hazeAlpha(zToTick(vZ));
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`

const LANE_FRAGMENT = /* glsl */ `
${TIME_GLSL}
${LINE_AA_GLSL}
uniform vec3 uColor;
uniform float uOpacity;
varying float vZ;
varying float vAcross;
void main() {
  float alpha = uOpacity * hazeAlpha(zToTick(vZ)) * lineCoverage(vAcross, ${LANE_THICKNESS.toFixed(3)});
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`

/**
 * Highway borders and octave lines (brief decision 111): a crisp core of the set width with a
 * soft halo that grows with the glow; on the glow layer, the core at the glow strength.
 */
const GLOW_LINE_FRAGMENT = /* glsl */ `
${TIME_GLSL}
${LINE_AA_GLSL}
uniform vec3 uColor;
uniform float uWidth;
uniform float uGlow;
varying float vZ;
varying float vAcross;
void main() {
  float haze = hazeAlpha(zToTick(vZ));
  float core = lineCoverage(vAcross, uWidth);
#ifdef GLOW_PASS
  gl_FragColor = vec4(uColor * core * uGlow * haze, 1.0);
#else
  float halo = 0.35 * min(uGlow, 1.0) * exp(-abs(vAcross) / min(1.5 * uWidth + 1e-3, 0.15));
  float alpha = haze * max(core, halo);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
#endif
}
`

const GRID_VERTEX = /* glsl */ `
${TIME_GLSL}
attribute float aTick;
attribute float aBar;  // 1 = bar line, 0 = beat line
varying float vTick;
varying float vBar;
varying float vAlong;
varying float vThickness;
void main() {
  float ahead = aTick - uTick;
  // Lines behind the now line or past the haze collapse to nothing.
  float visible = step(0.0, ahead) * step(ahead, 1.5 * uLookAheadTicks);
  float thickness = mix(${BEAT_THICKNESS.toFixed(3)}, ${BAR_THICKNESS.toFixed(3)}, aBar);
  float extent = (thickness + 2.0 * ${LINE_MARGIN.toFixed(3)}) * visible;
  // Local y runs away from the player (z decreasing), like the notes, so the quad faces up.
  float along = (position.y - 0.5) * extent;
  vec3 world = vec3(position.x * ${KEYBOARD.width.toFixed(1)}, 0.005, tickToZ(aTick) - along);
  vTick = aTick;
  vBar = aBar;
  vAlong = along;
  vThickness = thickness;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const GRID_FRAGMENT = /* glsl */ `
${TIME_GLSL}
${LINE_AA_GLSL}
uniform vec3 uBarColor;
uniform float uBarOpacity;
uniform vec3 uBeatColor;
uniform float uBeatOpacity;
uniform float uBarGlow;
uniform float uBeatGlow;
varying float vTick;
varying float vBar;
varying float vAlong;
varying float vThickness;
void main() {
  vec3 color = mix(uBeatColor, uBarColor, vBar);
#ifdef GLOW_PASS
  float glow = mix(uBeatGlow, uBarGlow, vBar) * hazeAlpha(vTick) * lineCoverage(vAlong, vThickness);
  gl_FragColor = vec4(color * glow, 1.0);
#else
  float alpha = mix(uBeatOpacity, uBarOpacity, vBar) * hazeAlpha(vTick);
  alpha *= lineCoverage(vAlong, vThickness);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(color, alpha);
#endif
}
`

const FLAT_VERTEX = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FLAT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uColor, uOpacity);
}
`

/** Quad spanning x 0..1, y 0..1 (instanced across the keyboard width). */
function unitQuad(geometry: BufferGeometry): void {
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
  )
  geometry.setIndex([0, 1, 2, 0, 2, 3])
}

/**
 * Strips running the length of the highway from the now line, one per [x0, x1] range, at
 * height y. `aAcross` is each vertex's x distance from its strip's centre.
 */
function strips(ranges: readonly (readonly [number, number])[], y: number): BufferGeometry {
  const nowZ = -KEYBOARD.whiteLength
  const positions: number[] = []
  const across: number[] = []
  const index: number[] = []
  for (const [x0, x1] of ranges) {
    const base = positions.length / 3
    const half = (x1 - x0) / 2
    positions.push(
      x0,
      y,
      nowZ,
      x1,
      y,
      nowZ,
      x1,
      y,
      nowZ - SURFACE_LENGTH,
      x0,
      y,
      nowZ - SURFACE_LENGTH,
    )
    across.push(-half, half, half, -half)
    index.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('aAcross', new BufferAttribute(new Float32Array(across), 1))
  geometry.setIndex(index)
  return geometry
}

function flatMaterial(color: string, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: FLAT_VERTEX,
    fragmentShader: FLAT_FRAGMENT,
    uniforms: { uColor: { value: srgb(color) }, uOpacity: { value: opacity } },
    transparent: true,
    depthWrite: false,
  })
}

/** A set of glowing lines along the highway (borders or octave lines) and its glow twin. */
interface GlowLines {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>
  readonly twin: GlowTwin
}

/** Which boundaries the ordinary lane-line mesh draws (the rest are glowing lines). */
interface LaneSplit {
  readonly borders: boolean
  readonly octaves: boolean
  readonly ef: boolean
}

/**
 * The highway: surface, darker black-key lanes, lane lines at the white-key boundaries (the
 * borders and octave lines optionally as glowing lines), scrolling bar and beat lines (from the
 * bar map, so meter overrides apply), the now line, and optional look-ahead guides. Every
 * material is a ShaderMaterial writing display-space colour.
 */
export class Highway {
  readonly group = new Group()
  private readonly surface: Mesh<PlaneGeometry, ShaderMaterial>
  private readonly blackLanes: Mesh<BufferGeometry, ShaderMaterial>
  private readonly lanes: Mesh<BufferGeometry, ShaderMaterial>
  private readonly grid: Mesh<InstancedBufferGeometry, ShaderMaterial>
  private readonly gridTwin: GlowTwin<InstancedBufferGeometry>
  private readonly borders: GlowLines
  private readonly octaves: GlowLines
  private readonly nowLine: NowLine
  private readonly guides: Mesh<PlaneGeometry, ShaderMaterial>[]
  private split: LaneSplit | null = null
  private efOn = false

  constructor(
    beats: readonly { readonly tick: number; readonly isBar: boolean }[],
    time: TimeUniforms,
  ) {
    const nowZ = -KEYBOARD.whiteLength

    const surfaceGeometry = new PlaneGeometry(KEYBOARD.width + 1, SURFACE_LENGTH)
    surfaceGeometry.rotateX(-Math.PI / 2)
    surfaceGeometry.translate(KEYBOARD.width / 2, 0, nowZ - SURFACE_LENGTH / 2)
    surfaceGeometry.setAttribute(
      'aAcross',
      new BufferAttribute(new Float32Array(surfaceGeometry.getAttribute('position').count), 1),
    )
    this.surface = new Mesh(
      surfaceGeometry,
      new ShaderMaterial({
        vertexShader: STATIC_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
        uniforms: {
          ...time,
          uColor: { value: srgb('#0A0F1E') },
          uFadeTo: { value: srgb('#05070F') },
        },
      }),
    )
    this.surface.renderOrder = 0

    // Black-key lanes, a little darker than the surface (brief decision 42).
    const blackRanges = keyLayout()
      .filter((k) => k.isBlack)
      .map((k) => [k.x, k.x + k.width] as const)
    this.blackLanes = new Mesh(
      strips(blackRanges, 0.002),
      new ShaderMaterial({
        vertexShader: STATIC_VERTEX,
        fragmentShader: SHADE_FRAGMENT,
        uniforms: { ...time, uStrength: { value: 0.22 } },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.blackLanes.renderOrder = 0.5

    // Lane lines: one strip per white-key boundary, wider than the line (see LINE_MARGIN). The
    // geometry is rebuilt when borders or octave lines take over some boundaries.
    this.lanes = new Mesh(
      new BufferGeometry(),
      new ShaderMaterial({
        vertexShader: STATIC_VERTEX,
        fragmentShader: LANE_FRAGMENT,
        uniforms: { ...time, uColor: { value: srgb('#3A4A6E') }, uOpacity: { value: 0.35 } },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.lanes.renderOrder = 2
    this.setLaneSplit({ borders: false, octaves: false, ef: false })

    this.borders = this.glowLines(time, ['border'])
    this.octaves = this.glowLines(time, ['octave'])

    const gridGeometry = new InstancedBufferGeometry()
    unitQuad(gridGeometry)
    gridGeometry.setAttribute(
      'aTick',
      new InstancedBufferAttribute(new Float32Array(beats.map((b) => b.tick)), 1),
    )
    gridGeometry.setAttribute(
      'aBar',
      new InstancedBufferAttribute(new Float32Array(beats.map((b) => (b.isBar ? 1 : 0))), 1),
    )
    gridGeometry.instanceCount = beats.length
    this.grid = new Mesh(
      gridGeometry,
      new ShaderMaterial({
        vertexShader: GRID_VERTEX,
        fragmentShader: GRID_FRAGMENT,
        uniforms: {
          ...time,
          uBarColor: { value: srgb('#5C6F99') },
          uBarOpacity: { value: 0.6 },
          uBeatColor: { value: srgb('#5C6F99') },
          uBeatOpacity: { value: 0.12 },
          uBarGlow: { value: 0 },
          uBeatGlow: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.grid.frustumCulled = false
    this.grid.renderOrder = 2
    this.gridTwin = new GlowTwin(this.grid, 'emitter')

    this.nowLine = new NowLine(time)

    // Debug-only look-ahead markers at 1x (amber) and 1.5x (magenta); placed by setGuides().
    this.guides = ['#FFB000', '#FF3DD8'].map((color) => {
      const g = new PlaneGeometry(KEYBOARD.width, 0.12)
      g.rotateX(-Math.PI / 2)
      g.translate(KEYBOARD.width / 2, 0.03, 0)
      const mesh = new Mesh(g, flatMaterial(color, 1))
      mesh.renderOrder = 5
      mesh.visible = false
      return mesh
    })

    this.group.add(
      this.surface,
      this.blackLanes,
      this.lanes,
      this.borders.mesh,
      this.borders.twin.mesh,
      this.octaves.mesh,
      this.octaves.twin.mesh,
      this.grid,
      this.gridTwin.mesh,
      ...this.nowLine.meshes,
      ...this.guides,
    )
  }

  applySettings(settings: PlayerSettings): void {
    const { colors, opacity, highway, lines, appearance } = settings
    this.setUniform(this.surface.material, 'uColor', srgb(colors.highway))
    this.setUniform(this.surface.material, 'uFadeTo', srgb(colors.background))
    this.blackLanes.visible = highway.blackLaneShading && highway.blackLaneShadingStrength > 0
    this.setUniform(this.blackLanes.material, 'uStrength', highway.blackLaneShadingStrength)
    this.setUniform(this.lanes.material, 'uColor', srgb(colors.lane))
    this.setUniform(this.lanes.material, 'uOpacity', opacity.lane)
    this.setUniform(this.grid.material, 'uBarColor', srgb(colors.bar))
    this.setUniform(this.grid.material, 'uBarOpacity', opacity.bar)
    this.setUniform(this.grid.material, 'uBeatColor', srgb(colors.beat))
    this.setUniform(this.grid.material, 'uBeatOpacity', opacity.beat)
    this.setUniform(this.grid.material, 'uBarGlow', lines.barGlow)
    this.setUniform(this.grid.material, 'uBeatGlow', lines.beatGlow)
    this.gridTwin.enabled = lines.barGlow > 0 || lines.beatGlow > 0

    this.setLaneSplit({ borders: lines.borders, octaves: lines.octaves, ef: lines.octavesEF })
    this.styleGlowLines(
      this.borders,
      lines.borders,
      lineColor(lines.bordersColor, lines.bordersCustom, appearance),
      lines.bordersWidth,
      lines.bordersGlow,
    )
    if (lines.octaves && lines.octavesEF !== this.efOn) {
      this.efOn = lines.octavesEF
      const old = this.octaves.mesh.geometry
      this.octaves.mesh.geometry = this.glowGeometry(this.efOn ? ['octave', 'ef'] : ['octave'])
      old.dispose()
    }
    this.styleGlowLines(
      this.octaves,
      lines.octaves,
      lineColor(lines.octavesColor, lines.octavesCustom, appearance),
      lines.octavesWidth,
      lines.octavesGlow,
    )
    this.nowLine.applySettings(lines, appearance)
  }

  /** Shows or hides the glow twins (only drawn while bloom runs). */
  syncGlow(bloomActive: boolean): void {
    this.gridTwin.sync(bloomActive)
    this.borders.twin.sync(bloomActive)
    this.octaves.twin.sync(bloomActive)
    this.nowLine.syncGlow(bloomActive)
  }

  /** Shows the 1x and 1.5x look-ahead markers at the given z positions (debug review aid). */
  setGuides(visible: boolean, oneX: number, onePointFiveX: number): void {
    const [a, b] = this.guides
    if (a) {
      a.visible = visible
      a.position.z = oneX
    }
    if (b) {
      b.visible = visible
      b.position.z = onePointFiveX
    }
  }

  dispose(): void {
    const meshes = [
      this.surface,
      this.blackLanes,
      this.lanes,
      this.borders.mesh,
      this.octaves.mesh,
      this.grid,
      ...this.guides,
    ]
    for (const mesh of meshes) {
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
    for (const twin of [this.gridTwin, this.borders.twin, this.octaves.twin]) twin.dispose()
    this.nowLine.dispose()
  }

  /** Rebuilds the lane-line strips without the boundaries drawn as glowing lines. */
  private setLaneSplit(split: LaneSplit): void {
    const old = this.split
    if (
      old !== null &&
      old.borders === split.borders &&
      old.octaves === split.octaves &&
      old.ef === split.ef
    ) {
      return
    }
    this.split = split
    const taken = (kind: BoundaryKind) =>
      (kind === 'border' && split.borders) ||
      (kind === 'octave' && split.octaves) ||
      (kind === 'ef' && split.octaves && split.ef)
    const half = LANE_THICKNESS / 2 + LINE_MARGIN
    const ranges = laneBoundaries()
      .filter((b) => !taken(b.kind))
      .map((b) => [b.x - half, b.x + half] as const)
    const previous = this.lanes.geometry
    this.lanes.geometry = strips(ranges, 0.004)
    previous.dispose()
  }

  private glowGeometry(kinds: readonly BoundaryKind[]): BufferGeometry {
    const ranges = laneBoundaries()
      .filter((b) => kinds.includes(b.kind))
      .map((b) => [b.x - GLOW_LINE_HALF, b.x + GLOW_LINE_HALF] as const)
    // Just above the lane lines, under the bar lines and notes.
    return strips(ranges, 0.0045)
  }

  private glowLines(time: TimeUniforms, kinds: readonly BoundaryKind[]): GlowLines {
    const mesh = new Mesh(
      this.glowGeometry(kinds),
      new ShaderMaterial({
        vertexShader: STATIC_VERTEX,
        fragmentShader: GLOW_LINE_FRAGMENT,
        uniforms: {
          ...time,
          uColor: { value: srgb('#FFFFFF') },
          uWidth: { value: 0.05 },
          uGlow: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    mesh.renderOrder = 2.1
    mesh.visible = false
    return { mesh, twin: new GlowTwin(mesh, 'emitter') }
  }

  private styleGlowLines(
    lines: GlowLines,
    on: boolean,
    color: string,
    width: number,
    glow: number,
  ): void {
    lines.mesh.visible = on
    this.setUniform(lines.mesh.material, 'uColor', srgb(color))
    this.setUniform(lines.mesh.material, 'uWidth', width)
    this.setUniform(lines.mesh.material, 'uGlow', glow)
    lines.twin.enabled = on && glow > 0
  }

  private setUniform(material: ShaderMaterial, name: string, value: unknown): void {
    const uniform = material.uniforms[name]
    if (uniform) uniform.value = value
  }
}
