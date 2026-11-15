import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'

import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { KEYBOARD } from './model/KEYBOARD'
import { srgb } from './srgb'
import { TIME_GLSL } from './timeGlsl'
import type { TimeUniforms } from './TimeUniforms'

/** Far enough for the longest visible highway (cameraFit caps it at 300). */
const SURFACE_LENGTH = 320
const BAR_THICKNESS = 0.16
const BEAT_THICKNESS = 0.08
const LANE_THICKNESS = 0.03

/** A static quad mesh on the highway whose fragments fade by their distance in ticks. */
const STATIC_VERTEX = /* glsl */ `
varying float vZ;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vZ = world.z;
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

const LINE_FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform vec3 uColor;
uniform float uOpacity;
varying float vZ;
void main() {
  float alpha = uOpacity * hazeAlpha(zToTick(vZ));
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`

const GRID_VERTEX = /* glsl */ `
${TIME_GLSL}
attribute float aTick;
attribute float aBar;  // 1 = bar line, 0 = beat line
varying float vTick;
varying float vBar;
void main() {
  float ahead = aTick - uTick;
  // Lines behind the now line or past the haze collapse to nothing.
  float visible = step(0.0, ahead) * step(ahead, 1.5 * uLookAheadTicks);
  float thickness = mix(${BEAT_THICKNESS.toFixed(3)}, ${BAR_THICKNESS.toFixed(3)}, aBar) * visible;
  // Local y runs away from the player (z decreasing), like the notes, so the quad faces up.
  vec3 world = vec3(position.x * ${KEYBOARD.width.toFixed(1)}, 0.005, tickToZ(aTick) - (position.y - 0.5) * thickness);
  vTick = aTick;
  vBar = aBar;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const GRID_FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform vec3 uBarColor;
uniform float uBarOpacity;
uniform vec3 uBeatColor;
uniform float uBeatOpacity;
varying float vTick;
varying float vBar;
void main() {
  vec3 color = mix(uBeatColor, uBarColor, vBar);
  float alpha = mix(uBeatOpacity, uBarOpacity, vBar) * hazeAlpha(vTick);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(color, alpha);
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
 * The highway: surface, lane lines at the white-key boundaries, scrolling bar and beat lines
 * (from the bar map, so meter overrides apply), the now line, and optional look-ahead guides.
 */
export class Highway {
  readonly group = new Group()
  private readonly surface: Mesh<PlaneGeometry, ShaderMaterial>
  private readonly lanes: Mesh<BufferGeometry, ShaderMaterial>
  private readonly grid: Mesh<InstancedBufferGeometry, ShaderMaterial>
  private readonly nowLine: Mesh<PlaneGeometry, MeshBasicMaterial>
  private readonly guides: Mesh<PlaneGeometry, MeshBasicMaterial>[]

  constructor(
    beats: readonly { readonly tick: number; readonly isBar: boolean }[],
    time: TimeUniforms,
  ) {
    const nowZ = -KEYBOARD.whiteLength

    const surfaceGeometry = new PlaneGeometry(KEYBOARD.width + 1, SURFACE_LENGTH)
    surfaceGeometry.rotateX(-Math.PI / 2)
    surfaceGeometry.translate(KEYBOARD.width / 2, 0, nowZ - SURFACE_LENGTH / 2)
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

    // Lane lines: one thin strip per white-key boundary, running the length of the highway.
    const positions: number[] = []
    const index: number[] = []
    for (let i = 0; i <= KEYBOARD.whiteCount; i++) {
      const x0 = i - LANE_THICKNESS / 2
      const x1 = i + LANE_THICKNESS / 2
      const base = positions.length / 3
      positions.push(
        x0,
        0.004,
        nowZ,
        x1,
        0.004,
        nowZ,
        x1,
        0.004,
        nowZ - SURFACE_LENGTH,
        x0,
        0.004,
        nowZ - SURFACE_LENGTH,
      )
      index.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    const laneGeometry = new BufferGeometry()
    laneGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    laneGeometry.setIndex(index)
    this.lanes = new Mesh(laneGeometry, this.lineMaterial(time))
    this.lanes.renderOrder = 2

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
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.grid.frustumCulled = false
    this.grid.renderOrder = 2

    const nowGeometry = new PlaneGeometry(KEYBOARD.width, 0.08)
    nowGeometry.rotateX(-Math.PI / 2)
    nowGeometry.translate(KEYBOARD.width / 2, 0.006, nowZ)
    this.nowLine = new Mesh(
      nowGeometry,
      new MeshBasicMaterial({
        color: '#BFD2FF',
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    )
    this.nowLine.renderOrder = 4

    // Debug-only look-ahead markers at 1x (amber) and 1.5x (magenta); placed by setGuides().
    this.guides = ['#FFB000', '#FF3DD8'].map((color) => {
      const g = new PlaneGeometry(KEYBOARD.width, 0.12)
      g.rotateX(-Math.PI / 2)
      g.translate(KEYBOARD.width / 2, 0.03, 0)
      const mesh = new Mesh(
        g,
        new MeshBasicMaterial({ color, depthWrite: false, transparent: true }),
      )
      mesh.renderOrder = 5
      mesh.visible = false
      return mesh
    })

    this.group.add(this.surface, this.lanes, this.grid, this.nowLine, ...this.guides)
  }

  applySettings(settings: PlayerSettings): void {
    const { colors, opacity } = settings
    this.setUniform(this.surface.material, 'uColor', srgb(colors.highway))
    this.setUniform(this.surface.material, 'uFadeTo', srgb(colors.background))
    this.setUniform(this.lanes.material, 'uColor', srgb(colors.lane))
    this.setUniform(this.lanes.material, 'uOpacity', opacity.lane)
    this.setUniform(this.grid.material, 'uBarColor', srgb(colors.bar))
    this.setUniform(this.grid.material, 'uBarOpacity', opacity.bar)
    this.setUniform(this.grid.material, 'uBeatColor', srgb(colors.beat))
    this.setUniform(this.grid.material, 'uBeatOpacity', opacity.beat)
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
    for (const mesh of [this.surface, this.lanes, this.grid, this.nowLine, ...this.guides]) {
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  }

  private lineMaterial(time: TimeUniforms): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader: STATIC_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      uniforms: { ...time, uColor: { value: srgb('#3A4A6E') }, uOpacity: { value: 0.35 } },
      transparent: true,
      depthWrite: false,
    })
  }

  private setUniform(material: ShaderMaterial, name: string, value: unknown): void {
    const uniform = material.uniforms[name]
    if (uniform) uniform.value = value
  }
}
