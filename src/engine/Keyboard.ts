import {
  type BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
} from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { beveledBox } from './geometry/beveledBox'
import type { KeyBody } from './model/KeyBody'
import { keyBodies } from './model/keyBodies'
import { KEYBOARD } from './model/KEYBOARD'
import { KEY_RESTRIKE_PROGRESS, keyPressAngle, keyPressStep } from './model/keyPress'
import type { KeyState } from './model/KeyState'
import { LIGHT_GLSL } from './sceneLight'
import { srgb } from './srgb'

type KeyboardSettings = PlayerSettings['keyboard']

const VERTEX = /* glsl */ `
attribute vec4 aOverlay; // pitch colour, alpha
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vOverlay;
varying float vTop;
void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  // Instance matrices are rigid (pivot + rotation), so the upper 3×3 rotates normals correctly.
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vWorld = world.xyz;
  vOverlay = aOverlay;
  // The overlay colours the key's top (and its top bevels), in key space: it moves with a press.
  vTop = step(0.5, normal.y);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const FRAGMENT = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uBase;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vOverlay;
varying float vTop;
void main() {
  vec3 n = normalize(vNormal);
  vec3 lit = shade(uBase, n, normalize(cameraPosition - vWorld));
  // The pitch colour stays vivid (unlit), as on the highway.
  gl_FragColor = vec4(mix(lit, vOverlay.rgb, vOverlay.a * vTop), 1.0);
}
`

interface KeyGroup {
  readonly mesh: InstancedMesh<BufferGeometry, ShaderMaterial>
  readonly overlay: Float32Array
  /** Index into the 88 keys for each instance. */
  readonly keys: readonly number[]
}

/**
 * The 88 keys as two instanced meshes (white, black), lit in the shader, with the pitch-colour
 * overlay on each key's top. Keys pivot down (about a point at or behind their back edge, like a
 * real key's balance rail) while their note sounds.
 * Dimensions and edge profile come from the keyboard settings (rebuilt only when they change).
 */
export class Keyboard {
  readonly group = new Group()
  private bodies: readonly KeyBody[] = []
  private settings: KeyboardSettings = DEFAULT_SETTINGS.keyboard
  private white: KeyGroup | null = null
  private black: KeyGroup | null = null
  private readonly progress = new Float32Array(88)
  private readonly matrix = new Matrix4()
  private readonly rotation = new Matrix4()
  private readonly offset = new Matrix4()
  private readonly materials: ShaderMaterial[]

  constructor() {
    this.materials = [this.material('#E9E9E4'), this.material('#141416')]
    this.rebuild(DEFAULT_SETTINGS.keyboard)
  }

  /** Key tops, for effects placement. */
  get keyBodies(): readonly KeyBody[] {
    return this.bodies
  }

  /** Rebuilds geometry when the keyboard settings change (cheap; not every frame). */
  rebuild(settings: KeyboardSettings): void {
    this.settings = settings
    this.disposeMeshes()
    this.bodies = keyBodies(settings)
    const whiteKeys = this.bodies.flatMap((b, i) => (b.isBlack ? [] : [i]))
    const blackKeys = this.bodies.flatMap((b, i) => (b.isBlack ? [i] : []))
    this.white = this.keyGroup(whiteKeys, this.materials[0] as ShaderMaterial)
    this.black = this.keyGroup(blackKeys, this.materials[1] as ShaderMaterial)
    this.group.add(this.white.mesh, this.black.mesh)
    this.writeMatrices()
  }

  /** A new onset on a key that is still down: it lifts part-way and presses again. */
  restrike(midi: number): void {
    const i = midi - KEYBOARD.lowest
    if (i < 0 || i >= 88) return
    this.progress[i] = Math.min(this.progress[i] as number, KEY_RESTRIKE_PROGRESS)
  }

  /** States in key order (KeyStates.at()); `dt` in seconds advances the press animation. */
  update(states: readonly KeyState[], dt: number): void {
    const animate = this.settings.animate
    states.forEach((state, i) => {
      this.progress[i] = animate ? keyPressStep(this.progress[i] as number, state.sounding, dt) : 0
    })
    for (const group of [this.white, this.black]) {
      if (group === null) continue
      group.keys.forEach((key, j) => {
        const state = states[key]
        if (state === undefined) return
        const c = PALETTE[state.colorIndex]
        group.overlay.set([c?.r ?? 1, c?.g ?? 1, c?.b ?? 1, state.alpha], j * 4)
      })
      const attribute = group.mesh.geometry.getAttribute('aOverlay')
      attribute.needsUpdate = true
    }
    this.writeMatrices()
  }

  dispose(): void {
    this.disposeMeshes()
    for (const m of this.materials) m.dispose()
  }

  private keyGroup(keys: readonly number[], material: ShaderMaterial): KeyGroup {
    const first = this.bodies[keys[0] ?? 0] as KeyBody
    const { edgeProfile, edgeSize } = this.settings
    const geometry = beveledBox(first.width, first.thickness, first.length, edgeProfile, edgeSize)
    const overlay = new Float32Array(keys.length * 4)
    geometry.setAttribute('aOverlay', new InstancedBufferAttribute(overlay, 4))
    const mesh = new InstancedMesh(geometry, material, keys.length)
    // The press animation moves instances; bounds computed at build time would be wrong.
    mesh.frustumCulled = false
    mesh.renderOrder = 6
    return { mesh, overlay, keys }
  }

  /** Each key: pivot behind its top back edge, rotate by its press, then centre the body. */
  private writeMatrices(): void {
    const backZ = -KEYBOARD.whiteLength
    for (const group of [this.white, this.black]) {
      if (group === null) continue
      group.keys.forEach((key, j) => {
        const body = this.bodies[key] as KeyBody
        const angle = keyPressAngle(
          this.progress[key] as number,
          body.pressDepth,
          body.length,
          body.pivotOffset,
        )
        // Pivot at the key top's height, pivotOffset behind the visible back edge (pressedKeyTop
        // describes the same pose).
        this.matrix.makeTranslation(body.centerX, body.top, backZ - body.pivotOffset)
        this.rotation.makeRotationX(angle)
        this.offset.makeTranslation(0, -body.thickness / 2, body.pivotOffset + body.length / 2)
        this.matrix.multiply(this.rotation).multiply(this.offset)
        group.mesh.setMatrixAt(j, this.matrix)
      })
      group.mesh.instanceMatrix.needsUpdate = true
    }
  }

  private material(base: string): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uBase: { value: srgb(base) } },
    })
  }

  private disposeMeshes(): void {
    for (const group of [this.white, this.black]) {
      if (group === null) continue
      this.group.remove(group.mesh)
      group.mesh.geometry.dispose()
      group.mesh.dispose()
    }
    this.white = null
    this.black = null
  }
}

const PALETTE = PITCH_CLASS_COLORS.map((c) => srgb(c.hex))
