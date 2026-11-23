import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  FloatType,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  type Texture,
} from 'three'

import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { beveledBox } from './geometry/beveledBox'
import { GlowTwin } from './GlowTwin'
import type { KeyBody } from './model/KeyBody'
import { keyBodies } from './model/keyBodies'
import { KEYBOARD } from './model/KEYBOARD'
import { KEY_RESTRIKE_PROGRESS, keyPressAngle, keyPressStep } from './model/keyPress'
import type { KeyState } from './model/KeyState'
import { ATLAS_FONT_PX, atlasCell, CELL_H, CELL_W } from './names/NoteLabelAtlas'
import { LIGHT_GLSL } from './sceneLight'
import type { NoteColors } from './NoteColors'
import { srgb } from './srgb'

type KeyboardSettings = PlayerSettings['keyboard']

/** Neighbours each side a key samples for spilled light, per shader detail (semitones). */
const SPILL_TAPS = { minimal: 0, low: 2, medium: 4, high: 6 } as const
const MAX_TAPS = 6

const VERTEX = /* glsl */ `
attribute vec4 aOverlay; // pitch colour, alpha
attribute float aKey;    // 0–87
attribute float aPulse;  // note-on pulse, 0 = none
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vOverlay;
varying float vTop;
varying float vKey;
varying float vPulse;
void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  // Instance matrices are rigid (pivot + rotation), so the upper 3×3 rotates normals correctly.
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vWorld = world.xyz;
  vOverlay = aOverlay;
  // The overlay colours the key's top (and its top bevels), in key space: it moves with a press.
  vTop = step(0.5, normal.y);
  vKey = aKey;
  vPulse = aPulse;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const FRAGMENT = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uBase;
uniform sampler2D uLight;   // row 0: light colour × intensity, intensity; row 1: key centre x
uniform float uSpill;
uniform float uSpillReach;
uniform float uSpillTaps;
uniform float uOverlayGlow;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vOverlay;
varying float vTop;
varying float vKey;
varying float vPulse;

vec3 spilled() {
  vec3 sum = vec3(0.0);
  for (int k = -${MAX_TAPS}; k <= ${MAX_TAPS}; k++) {
    if (k == 0 || abs(float(k)) > uSpillTaps) continue;
    float j = vKey + float(k);
    if (j < 0.0 || j > 87.0) continue;
    float u = (j + 0.5) / 88.0;
    vec4 light = texture2D(uLight, vec2(u, 0.25));
    if (light.a <= 0.0) continue;
    float x = texture2D(uLight, vec2(u, 0.75)).r;
    sum += light.rgb * exp(-abs(vWorld.x - x) / uSpillReach);
  }
  return sum;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 lit = shade(uBase, n, normalize(cameraPosition - vWorld));
  vec3 spill = vec3(0.0);
  if (uSpill > 0.0 && uSpillTaps > 0.0) spill = spilled() * uSpill;
  // The pitch colour stays vivid (unlit), as on the highway; a pulse flashes it whiter.
  vec3 overlay = vOverlay.rgb;
  if (vPulse > 0.0) overlay = mix(overlay, vec3(1.0), 0.5 * min(vPulse, 1.0));
  float a = vOverlay.a * vTop;
#ifdef GLOW_PASS
  // An occluder on the glow layer: black, except lit overlays, pulses and spilled light.
  gl_FragColor = vec4(overlay * a * (uOverlayGlow + vPulse) + spill * 0.5, 1.0);
#else
  gl_FragColor = vec4(mix(lit + spill, overlay, a), 1.0);
#endif
}
`

const CONE_VERTEX = /* glsl */ `
uniform float uSpread;
attribute vec4 aCone; // light colour, intensity
varying vec4 vCone;
varying vec2 vUv;
void main() {
  vec3 p = position;
  p.x *= uSpread;
  vCone = aCone;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
}
`

const CONE_FRAGMENT = /* glsl */ `
uniform float uStrength;
varying vec4 vCone;
varying vec2 vUv;
void main() {
  // Brightest at the back edge (the now line), fading toward the player and to the sides.
  float along = pow(vUv.y, 1.2);
  float across = 1.0 - smoothstep(0.25, 1.0, abs(vUv.x * 2.0 - 1.0));
  float f = vCone.a * uStrength * along * across;
  if (f <= 0.002) discard;
  gl_FragColor = vec4(vCone.rgb * f, 1.0);
}
`

const LABEL_VERTEX = /* glsl */ `
uniform float uKeyTextPx;   // CSS px
uniform vec2 uViewport;     // drawing buffer, px
uniform float uPixelRatio;
attribute vec4 aCell; // atlas u0, v0, u1, v1
attribute vec4 aOverlay; // the key's lit colour and alpha (shared with the key mesh)
attribute float aBlack;
attribute vec4 aDims;   // key top y, label front z, key width, share of the width text may use
attribute float aGlyph; // the name's width in ems (from the atlas)
varying vec2 vUv;
varying vec4 vOverlay;
varying float vBlack;
varying float vFade;

vec2 toPx(mat4 m, vec3 p) {
  vec4 c = projectionMatrix * viewMatrix * m * vec4(p, 1.0);
  return (c.xy / c.w * 0.5 + 0.5) * uViewport;
}

void main() {
  // "Key label size" on screen (brief decision 114), shrunk to fit the key; under ~7 px a label
  // fades out rather than render a smudge. Sized upright on screen, not stretched by the tilt.
  mat4 m = modelMatrix * instanceMatrix;
  vec3 front = vec3(0.0, aDims.x, aDims.y);
  vec2 p = toPx(m, front);
  float pxX = max(distance(p, toPx(m, front + vec3(1.0, 0.0, 0.0))), 1e-3);
  float pxZ = max(distance(p, toPx(m, front - vec3(0.0, 0.0, 1.0))), 1e-3);
  float fitPx = aDims.z * aDims.w * pxX / max(aGlyph, 0.3) / uPixelRatio;
  float size = min(uKeyTextPx, fitPx);
  vFade = smoothstep(6.0, 8.0, size);
  float cellH = size * uPixelRatio * ${(CELL_H / ATLAS_FONT_PX).toFixed(4)};
  float width = cellH * ${(CELL_W / CELL_H).toFixed(4)} / pxX;
  float depth = min(cellH / pxZ, 2.0 * aDims.z);
  vec3 local = vec3(position.x * width, aDims.x, aDims.y - 0.5 * depth + position.z * depth);
  vUv = mix(aCell.xy, aCell.zw, uv);
  vOverlay = aOverlay;
  vBlack = aBlack;
  gl_Position = projectionMatrix * viewMatrix * m * vec4(local, 1.0);
}
`

const LABEL_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uShadow;
varying vec2 vUv;
varying vec4 vOverlay;
varying float vBlack;
varying float vFade;
void main() {
  if (vFade <= 0.01) discard;
  // The note-label atlas: red = text, green = halo (brief decision 114). Neutral while the key
  // rests (dark on white keys, light on black), the note's colour tinted light while it's held.
  vec4 t = texture2D(uAtlas, vUv);
  float text = t.r;
  float held = smoothstep(0.85, 1.0, vOverlay.a);
  vec3 rest = vBlack > 0.5 ? vec3(0.9, 0.92, 0.96) : vec3(0.1, 0.11, 0.14);
  vec3 color = mix(rest, mix(vOverlay.rgb, vec3(1.0), 0.75), held);
  bool light = dot(color, vec3(0.299, 0.587, 0.114)) > 0.5;
  vec3 haloColor = light ? vec3(0.02, 0.03, 0.06) : vec3(0.95);
  float halo = t.g * uShadow * (1.0 - text);
  float alpha = text + halo;
  if (alpha * vFade <= 0.01) discard;
  gl_FragColor = vec4((color * text + haloColor * halo) / alpha, alpha * vFade);
}
`

interface KeyGroup {
  readonly mesh: InstancedMesh<BufferGeometry, ShaderMaterial>
  readonly twin: GlowTwin
  readonly cones: InstancedMesh<BufferGeometry, ShaderMaterial>
  readonly labels: InstancedMesh<BufferGeometry, ShaderMaterial>
  readonly overlay: Float32Array
  readonly pulse: Float32Array
  readonly cone: Float32Array
  /** Index into the 88 keys for each instance. */
  readonly keys: readonly number[]
}

/**
 * The 88 keys as two instanced meshes (white, black), lit in the shader, with the pitch-colour
 * overlay on each key's top. Keys pivot down (about a point at or behind their back edge, like a
 * real key's balance rail) while their note sounds. Milestone 9: the overlay pulses on note-on
 * and glows; lit keys spill light onto their neighbours and can cast a light cone down the key
 * (brief decisions 113, 118); names can sit near the front of the key tops (decision 114).
 * Dimensions and edge profile come from the keyboard settings (rebuilt only when they change).
 */
export class Keyboard {
  readonly group = new Group()
  private bodies: readonly KeyBody[] = []
  private settings: KeyboardSettings = DEFAULT_SETTINGS.keyboard
  private white: KeyGroup | null = null
  private black: KeyGroup | null = null
  private readonly progress = new Float32Array(88)
  private readonly pulseAge = new Float32Array(88).fill(1e3)
  private readonly pulseScale = new Float32Array(88)
  private readonly matrix = new Matrix4()
  private readonly rotation = new Matrix4()
  private readonly offset = new Matrix4()
  private readonly materials: ShaderMaterial[]
  private readonly coneMaterial: ShaderMaterial
  private readonly labelMaterial: ShaderMaterial
  private readonly light: DataTexture
  private readonly lightData = new Float32Array(88 * 2 * 4)
  private effects: PlayerSettings['effects'] = DEFAULT_SETTINGS.effects
  private namesOnKeys = false
  private glyphEms: Float32Array = new Float32Array(88).fill(1)
  /** Light cones need medium shader detail or more (brief decision 110). */
  private coneOn = false

  constructor(
    atlas: Texture,
    private readonly noteColors: NoteColors,
  ) {
    this.light = new DataTexture(this.lightData, 88, 2, RGBAFormat, FloatType)
    this.light.magFilter = NearestFilter
    this.light.minFilter = NearestFilter
    this.materials = [this.material('#E9E9E4'), this.material('#141416')]
    this.coneMaterial = new ShaderMaterial({
      vertexShader: CONE_VERTEX,
      fragmentShader: CONE_FRAGMENT,
      uniforms: { uSpread: { value: 1 }, uStrength: { value: 0.4 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    this.labelMaterial = new ShaderMaterial({
      vertexShader: LABEL_VERTEX,
      fragmentShader: LABEL_FRAGMENT,
      uniforms: {
        uAtlas: { value: atlas },
        uShadow: { value: 0.6 },
        uKeyTextPx: { value: 11 },
        uViewport: { value: [1280, 720] },
        uPixelRatio: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })
    this.rebuild(DEFAULT_SETTINGS.keyboard)
  }

  /** Key tops, for effects placement. */
  get keyBodies(): readonly KeyBody[] {
    return this.bodies
  }

  /** Glow twins of the keys (occluders with glowing overlays). */
  get twins(): readonly GlowTwin[] {
    return [this.white, this.black].flatMap((g) => (g === null ? [] : [g.twin]))
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
    for (const g of [this.white, this.black]) {
      this.group.add(g.mesh, g.cones, g.labels)
    }
    this.writeLightPositions()
    this.writeMatrices()
    this.applyVisibility()
  }

  /** Key light, pulse and names from the settings (brief decisions 113, 114, 118). */
  applySettings(settings: PlayerSettings): void {
    const e = settings.effects
    this.effects = e
    const taps = SPILL_TAPS[settings.render.shaderDetail]
    for (const m of this.materials) {
      setUniform(m, 'uSpill', e.keySpill ? e.keySpillStrength : 0)
      setUniform(m, 'uSpillReach', e.keySpillSpread)
      setUniform(m, 'uSpillTaps', taps)
      setUniform(m, 'uOverlayGlow', e.soundingGlow ? e.soundingGlowAmount : 0)
    }
    setUniform(this.coneMaterial, 'uSpread', e.keyConeSpread)
    setUniform(this.coneMaterial, 'uStrength', e.keyConeStrength)
    this.coneOn = e.keyCone && taps >= SPILL_TAPS.medium
    this.namesOnKeys = settings.names.mode === 'keys' || settings.names.mode === 'both'
    setUniform(this.labelMaterial, 'uShadow', settings.names.shadow)
    setUniform(this.labelMaterial, 'uKeyTextPx', settings.names.keySize)
    this.applyVisibility()
  }

  /** Drawing-buffer size and device pixel ratio, for key labels sized on screen. */
  setViewport(bufferWidth: number, bufferHeight: number, pixelRatio: number): void {
    const u = this.labelMaterial.uniforms
    if (u.uViewport) u.uViewport.value = [bufferWidth, bufferHeight]
    setUniform(this.labelMaterial, 'uPixelRatio', pixelRatio)
  }

  /** Each name's width in ems (NoteLabelAtlas), so key labels shrink to fit their key. */
  setGlyphWidths(ems: Float32Array): void {
    this.glyphEms = ems
    for (const g of [this.white, this.black]) {
      if (g === null) continue
      const attribute = g.labels.geometry.getAttribute('aGlyph') as InstancedBufferAttribute
      ;(attribute.array as Float32Array).set(g.keys.map((k) => ems[k] ?? 1))
      attribute.needsUpdate = true
    }
  }

  /** A new onset on a key: a key still down lifts part-way and presses again; it pulses. */
  restrike(midi: number, scale = 1): void {
    const i = midi - KEYBOARD.lowest
    if (i < 0 || i >= 88) return
    this.progress[i] = Math.min(this.progress[i] as number, KEY_RESTRIKE_PROGRESS)
    this.pulseAge[i] = 0
    this.pulseScale[i] = scale
  }

  /** States in key order (KeyStates.at()); `dt` in seconds advances presses and pulses. */
  update(states: readonly KeyState[], dt: number): void {
    const animate = this.settings.animate
    const e = this.effects
    const decay = Math.max(e.pulseDecayMs / 1000, 1e-3)
    states.forEach((state, i) => {
      this.progress[i] = animate ? keyPressStep(this.progress[i] as number, state.sounding, dt) : 0
      this.pulseAge[i] = (this.pulseAge[i] as number) + dt
      // Key light: the sounding key's colour, at full strength while it sounds.
      const c = this.noteColors.at(state.colorIndex)
      const intensity = state.sounding ? 1 : 0
      this.lightData.set([c.r * intensity, c.g * intensity, c.b * intensity, intensity], i * 4)
    })
    this.light.needsUpdate = true
    for (const group of [this.white, this.black]) {
      if (group === null) continue
      group.keys.forEach((key, j) => {
        const state = states[key]
        if (state === undefined) return
        const c = this.noteColors.at(state.colorIndex)
        group.overlay.set([c.r, c.g, c.b, state.alpha], j * 4)
        const t = Math.max(0, 1 - (this.pulseAge[key] as number) / decay)
        group.pulse[j] = e.pulse ? e.pulseAmount * (this.pulseScale[key] as number) * t * t : 0
        const lit = state.sounding ? 1 : 0
        group.cone.set([c.r * lit, c.g * lit, c.b * lit, lit], j * 4)
      })
      for (const name of ['aOverlay', 'aPulse']) {
        group.mesh.geometry.getAttribute(name).needsUpdate = true
      }
      if (this.coneOn) group.cones.geometry.getAttribute('aCone').needsUpdate = true
    }
    this.writeMatrices()
  }

  dispose(): void {
    this.disposeMeshes()
    for (const m of this.materials) m.dispose()
    this.coneMaterial.dispose()
    this.labelMaterial.dispose()
    this.light.dispose()
  }

  private applyVisibility(): void {
    for (const g of [this.white, this.black]) {
      if (g === null) continue
      g.cones.visible = this.coneOn
      g.labels.visible = this.namesOnKeys
    }
  }

  private keyGroup(keys: readonly number[], material: ShaderMaterial): KeyGroup {
    const first = this.bodies[keys[0] ?? 0] as KeyBody
    const { edgeProfile, edgeSize } = this.settings
    const geometry = beveledBox(first.width, first.thickness, first.length, edgeProfile, edgeSize)
    const overlay = new Float32Array(keys.length * 4)
    const pulse = new Float32Array(keys.length)
    geometry.setAttribute('aOverlay', new InstancedBufferAttribute(overlay, 4))
    geometry.setAttribute('aPulse', new InstancedBufferAttribute(pulse, 1))
    geometry.setAttribute('aKey', new InstancedBufferAttribute(new Float32Array(keys), 1))
    const mesh = new InstancedMesh(geometry, material, keys.length)
    // The press animation moves instances; bounds computed at build time would be wrong.
    mesh.frustumCulled = false
    mesh.renderOrder = 6
    const twin = new GlowTwin(mesh, 'occluder')

    // Light cones and names lie on the key top, in key space: they follow the press.
    const top = first.thickness / 2
    const cone = new Float32Array(keys.length * 4)
    const coneGeometry = plane(first.width, first.length, top + 0.004, 0)
    coneGeometry.setAttribute('aCone', new InstancedBufferAttribute(cone, 4))
    const cones = new InstancedMesh(coneGeometry, this.coneMaterial, keys.length)
    cones.instanceMatrix = mesh.instanceMatrix
    cones.frustumCulled = false
    cones.renderOrder = 6.4

    // A unit quad: the shader sizes it on screen and places its front edge near the key's front.
    const labelGeometry = plane(1, 1, 0, 0)
    const labelFront = first.length / 2 - first.width * (first.isBlack ? 0.15 : 0.2)
    const textShare = first.isBlack ? 0.95 : 0.85
    labelGeometry.setAttribute(
      'aDims',
      new InstancedBufferAttribute(
        new Float32Array(keys.flatMap(() => [top + 0.003, labelFront, first.width, textShare])),
        4,
      ),
    )
    labelGeometry.setAttribute(
      'aGlyph',
      new InstancedBufferAttribute(Float32Array.from(keys.map((k) => this.glyphEms[k] ?? 1)), 1),
    )
    labelGeometry.setAttribute(
      'aCell',
      new InstancedBufferAttribute(new Float32Array(keys.flatMap((k) => atlasCell(k))), 4),
    )
    // The key's lit colour: the same attribute object as the key mesh's, so one update serves both.
    labelGeometry.setAttribute('aOverlay', geometry.getAttribute('aOverlay'))
    labelGeometry.setAttribute(
      'aBlack',
      new InstancedBufferAttribute(new Float32Array(keys.length).fill(first.isBlack ? 1 : 0), 1),
    )
    const labels = new InstancedMesh(labelGeometry, this.labelMaterial, keys.length)
    labels.instanceMatrix = mesh.instanceMatrix
    labels.frustumCulled = false
    labels.renderOrder = 6.5
    return { mesh, twin, cones, labels, overlay, pulse, cone, keys }
  }

  /** Each key's centre x, for the spill falloff. */
  private writeLightPositions(): void {
    this.bodies.forEach((body, i) => this.lightData.set([body.centerX, 0, 0, 0], (88 + i) * 4))
    this.light.needsUpdate = true
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
      uniforms: {
        uBase: { value: srgb(base) },
        uLight: { value: this.light },
        uSpill: { value: 0 },
        uSpillReach: { value: 1.5 },
        uSpillTaps: { value: 0 },
        uOverlayGlow: { value: 0 },
      },
    })
  }

  private disposeMeshes(): void {
    for (const group of [this.white, this.black]) {
      if (group === null) continue
      this.group.remove(group.mesh, group.cones, group.labels)
      group.mesh.geometry.dispose()
      group.mesh.dispose()
      group.twin.dispose()
      group.cones.geometry.dispose()
      group.labels.geometry.dispose()
    }
    this.white = null
    this.black = null
  }
}

function setUniform(material: ShaderMaterial, name: string, value: unknown): void {
  const u = material.uniforms[name]
  if (u) u.value = value
}

/**
 * A flat rectangle in key space at height y, `width` across and `depth` along the key, centred
 * at z; uv.y is 1 at the back edge (the now line) and 0 at the front.
 */
function plane(width: number, depth: number, y: number, z: number): BufferGeometry {
  const x0 = -width / 2
  const x1 = width / 2
  const back = z - depth / 2
  const front = z + depth / 2
  const g = new BufferGeometry()
  g.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([x0, y, back, x1, y, back, x1, y, front, x0, y, front]),
      3,
    ),
  )
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2))
  g.setIndex([0, 2, 1, 0, 3, 2])
  return g
}
