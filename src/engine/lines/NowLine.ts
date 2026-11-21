import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  Mesh,
  RGBAFormat,
  ShaderMaterial,
} from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { GlowTwin } from '../GlowTwin'
import { keyLayout } from '../model/keyLayout'
import { KEYBOARD } from '../model/KEYBOARD'
import { lineColor } from '../model/lineColor'
import { srgb } from '../srgb'
import type { TimeUniforms } from '../TimeUniforms'

/** Texels across the keyboard for the pitch colours (20 per white key). */
const PITCH_TEXELS = KEYBOARD.width * 20

/** How far each style's halo reaches, in line widths beyond the core. */
const HALO = { thin: 0, glowing: 4, neon: 6 } as const
const STYLE = { thin: 0, glowing: 1, neon: 2 } as const

const VERTEX = /* glsl */ `
uniform float uNowZ;
uniform float uHalf;
varying float vX;
varying float vAcross;
void main() {
  // position.x 0..1 across the keyboard, position.y −1..1 across the line's quad.
  float across = position.y * uHalf;
  vec3 world = vec3(position.x * ${KEYBOARD.width.toFixed(1)}, 0.006, uNowZ - across);
  vX = world.x / ${KEYBOARD.width.toFixed(1)};
  vAcross = across;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uPitch;    // 1 = colour of the key underneath
uniform sampler2D uPitchColors;
uniform float uStyle;    // 0 thin, 1 glowing, 2 neon
uniform float uWidth;
uniform float uGlow;
uniform float uOpacity;
varying float vX;
varying float vAcross;

float coverage(float d, float width) {
  float pixel = max(fwidth(d), 1e-5);
  return clamp((0.5 * width - abs(d)) / pixel + 0.5, 0.0, 1.0) * min(1.0, width / pixel);
}

void main() {
  vec3 color = mix(uColor, texture2D(uPitchColors, vec2(vX, 0.5)).rgb, uPitch);
  if (uStyle < 0.5) {
    // Thin: the milestone 8 now line, a flat quad of the line's width.
#ifdef GLOW_PASS
    gl_FragColor = vec4(color * uGlow, 1.0);
#else
    gl_FragColor = vec4(color, uOpacity);
#endif
    return;
  }
  float neon = step(1.5, uStyle);
  // Neon: a narrow near-white core inside a wide coloured halo.
  float coreWidth = uWidth * mix(1.0, 0.5, neon);
  float core = coverage(vAcross, coreWidth);
  float reach = uWidth * mix(1.2, 2.0, neon);
  float halo = exp(-abs(vAcross) / reach) * mix(0.45, 0.6, neon);
  vec3 coreColor = mix(color, vec3(1.0), 0.6 * neon);
#ifdef GLOW_PASS
  gl_FragColor = vec4((coreColor * core + color * halo * 0.5) * uGlow, 1.0);
#else
  float alpha = max(core * uOpacity, halo);
  if (alpha <= 0.002) discard;
  vec3 c = mix(color, coreColor, core);
  gl_FragColor = vec4(c, alpha);
#endif
}
`

/**
 * The now line (brief decision 111): thin (the milestone 8 line), glowing or neon, in a fixed
 * colour or the pitch colour of the key underneath, with a glow twin for bloom.
 */
export class NowLine {
  private readonly mesh: Mesh<BufferGeometry, ShaderMaterial>
  private readonly twin: GlowTwin
  private readonly pitchColors: DataTexture

  constructor(time: TimeUniforms) {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
    )
    geometry.setIndex([0, 1, 2, 0, 2, 3])
    this.pitchColors = pitchColorTexture()
    this.mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          // Only the now line's z is needed; it sits at the keys' back edge either way.
          uNowZ: time.uNowZ,
          uHalf: { value: 0.04 },
          uColor: { value: srgb('#BFD2FF') },
          uPitch: { value: 0 },
          uPitchColors: { value: this.pitchColors },
          uStyle: { value: 0 },
          uWidth: { value: 0.08 },
          uGlow: { value: 0 },
          uOpacity: { value: 0.8 },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 4
    this.twin = new GlowTwin(this.mesh, 'emitter')
  }

  get meshes(): readonly Mesh[] {
    return [this.mesh, this.twin.mesh]
  }

  applySettings(
    lines: PlayerSettings['lines'],
    appearance: Pick<PlayerSettings['appearance'], 'primary' | 'secondary'>,
  ): void {
    const u = this.mesh.material.uniforms
    const pitch = lines.nowColor === 'pitch'
    const hex = pitch ? '#FFFFFF' : lineColor(lines.nowColor, lines.nowCustom, appearance)
    set(u, 'uColor', srgb(hex))
    set(u, 'uPitch', pitch ? 1 : 0)
    set(u, 'uStyle', STYLE[lines.nowStyle])
    set(u, 'uWidth', lines.nowWidth)
    set(u, 'uGlow', lines.nowGlow)
    set(u, 'uHalf', lines.nowWidth / 2 + lines.nowWidth * HALO[lines.nowStyle])
    this.twin.enabled = lines.nowGlow > 0
  }

  syncGlow(bloomActive: boolean): void {
    this.twin.sync(bloomActive)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.twin.dispose()
    this.pitchColors.dispose()
  }
}

function set(uniforms: ShaderMaterial['uniforms'], name: string, value: unknown): void {
  const u = uniforms[name]
  if (u) u.value = value
}

/** The pitch colour under each texel across the keyboard; black keys cover their width. */
function pitchColorTexture(): DataTexture {
  const keys = keyLayout()
  const whites = keys.filter((k) => !k.isBlack)
  const blacks = keys.filter((k) => k.isBlack)
  const data = new Uint8Array(PITCH_TEXELS * 4)
  for (let i = 0; i < PITCH_TEXELS; i++) {
    const x = ((i + 0.5) / PITCH_TEXELS) * KEYBOARD.width
    const key =
      blacks.find((k) => x >= k.x && x < k.x + k.width) ??
      whites[Math.min(whites.length - 1, Math.floor(x))]
    const c = srgb(PITCH_CLASS_COLORS[(key?.midi ?? 0) % 12]?.hex ?? '#FFFFFF')
    data.set([c.r * 255, c.g * 255, c.b * 255, 255], i * 4)
  }
  const texture = new DataTexture(data, PITCH_TEXELS, 1, RGBAFormat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
