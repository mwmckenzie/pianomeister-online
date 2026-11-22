import {
  HalfFloatType,
  ShaderMaterial,
  type Texture,
  UniformsUtils,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { LuminosityHighPassShader } from 'three/addons/shaders/LuminosityHighPassShader.js'

/**
 * The blur scales of three's UnrealBloomPass at full resolution: kernel size and weight per
 * mip, from the sharpest (half the input) to the widest (1/32).
 */
const KERNELS = [6, 10, 14, 18, 22] as const
const FACTORS = [1.0, 0.8, 0.6, 0.4, 0.2] as const

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

interface Mip {
  readonly horizontal: WebGLRenderTarget
  readonly vertical: WebGLRenderTarget
  readonly blur: ShaderMaterial
}

/**
 * UnrealBloomPass's blur (bright pass, separable Gaussian mips, weighted composite), with the
 * number of mips following the input's scale (brief decision 110): a glow target at ½ or ¼
 * of the drawing buffer skips the sharpest one or two mips, so every preset blurs at the same
 * on-screen sizes — High looks as before, and Low runs four fewer full-screen passes. The
 * composite is the output; nothing is blended back onto the input.
 */
export class BloomChain {
  strength = 0.8
  radius = 0.4
  threshold = 0.1
  private readonly bright = target()
  private readonly composite = target()
  private readonly quad = new FullScreenQuad()
  private readonly highPass: ShaderMaterial
  private mips: Mip[] = []
  private compositeMaterial: ShaderMaterial | null = null
  /** Leading mips dropped: 0 at full resolution, 1 at ½, 2 at ¼. */
  private skip = -1
  private width = 1
  private height = 1

  constructor() {
    this.highPass = new ShaderMaterial({
      uniforms: UniformsUtils.clone(LuminosityHighPassShader.uniforms),
      vertexShader: LuminosityHighPassShader.vertexShader,
      fragmentShader: LuminosityHighPassShader.fragmentShader,
    })
    const smooth = this.highPass.uniforms.smoothWidth
    if (smooth) smooth.value = 0.01
    this.setSkip(0)
  }

  /** The blurred glow (the composite), at half the input's size. */
  get texture(): Texture {
    return this.composite.texture
  }

  /** Sets how many of the sharpest mips to drop (from the input's scale); rebuilds on change. */
  setSkip(skip: number): void {
    const next = Math.max(0, Math.min(KERNELS.length - 1, Math.round(skip)))
    if (next === this.skip) return
    this.skip = next
    this.disposeMips()
    this.mips = KERNELS.slice(next).map((kernel) => ({
      horizontal: target(),
      vertical: target(),
      blur: blurMaterial(kernel),
    }))
    this.compositeMaterial = compositeMaterial(FACTORS.slice(next))
    this.mips.forEach((mip, i) => {
      const texture = this.compositeMaterial?.uniforms[`uBlur${i}`]
      if (texture) texture.value = mip.vertical.texture
    })
    this.setSize(this.width, this.height)
  }

  /** The input's size in pixels. */
  setSize(width: number, height: number): void {
    this.width = width
    this.height = height
    let w = Math.max(1, Math.round(width / 2))
    let h = Math.max(1, Math.round(height / 2))
    this.bright.setSize(w, h)
    this.composite.setSize(w, h)
    for (const mip of this.mips) {
      mip.horizontal.setSize(w, h)
      mip.vertical.setSize(w, h)
      const size = mip.blur.uniforms.invSize
      if (size) size.value = new Vector2(1 / w, 1 / h)
      w = Math.max(1, Math.round(w / 2))
      h = Math.max(1, Math.round(h / 2))
    }
  }

  render(renderer: WebGLRenderer, input: Texture): void {
    // Every pass covers its whole target: no clears needed.
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    const u = this.highPass.uniforms
    if (u.tDiffuse) u.tDiffuse.value = input
    if (u.luminosityThreshold) u.luminosityThreshold.value = this.threshold
    this.pass(renderer, this.highPass, this.bright)
    let source = this.bright.texture
    for (const mip of this.mips) {
      const b = mip.blur.uniforms
      if (b.colorTexture) b.colorTexture.value = source
      if (b.direction) b.direction.value = HORIZONTAL
      this.pass(renderer, mip.blur, mip.horizontal)
      if (b.colorTexture) b.colorTexture.value = mip.horizontal.texture
      if (b.direction) b.direction.value = VERTICAL
      this.pass(renderer, mip.blur, mip.vertical)
      source = mip.vertical.texture
    }
    const c = this.compositeMaterial
    if (c !== null) {
      if (c.uniforms.uStrength) c.uniforms.uStrength.value = this.strength
      if (c.uniforms.uRadius) c.uniforms.uRadius.value = this.radius
      this.pass(renderer, c, this.composite)
    }
    renderer.autoClear = autoClear
  }

  dispose(): void {
    this.disposeMips()
    this.bright.dispose()
    this.composite.dispose()
    this.highPass.dispose()
    this.quad.dispose()
  }

  private pass(renderer: WebGLRenderer, material: ShaderMaterial, out: WebGLRenderTarget): void {
    this.quad.material = material
    renderer.setRenderTarget(out)
    this.quad.render(renderer)
  }

  private disposeMips(): void {
    for (const mip of this.mips) {
      mip.horizontal.dispose()
      mip.vertical.dispose()
      mip.blur.dispose()
    }
    this.mips = []
    this.compositeMaterial?.dispose()
    this.compositeMaterial = null
  }
}

const HORIZONTAL = new Vector2(1, 0)
const VERTICAL = new Vector2(0, 1)

function target(): WebGLRenderTarget {
  const t = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
  t.texture.generateMipmaps = false
  return t
}

/** UnrealBloomPass's separable Gaussian (adjacent taps merged into bilinear fetches). */
function blurMaterial(kernelRadius: number): ShaderMaterial {
  const sigma = kernelRadius / 3
  const coefficients: number[] = []
  for (let i = 0; i < kernelRadius; i++) {
    coefficients.push((0.39894 * Math.exp((-0.5 * i * i) / (sigma * sigma))) / sigma)
  }
  const offsets: number[] = []
  const weights: number[] = []
  for (let i = 1; i < kernelRadius; i += 2) {
    const wa = coefficients[i] ?? 0
    const wb = i + 1 < kernelRadius ? (coefficients[i + 1] ?? 0) : 0
    const w = wa + wb
    offsets.push((i * wa + (i + 1) * wb) / w)
    weights.push(w)
  }
  return new ShaderMaterial({
    defines: { KERNEL_PAIRS: offsets.length },
    uniforms: {
      colorTexture: { value: null },
      invSize: { value: new Vector2(0.5, 0.5) },
      direction: { value: HORIZONTAL },
      centerWeight: { value: coefficients[0] },
      gaussianOffsets: { value: offsets },
      gaussianWeights: { value: weights },
    },
    vertexShader: QUAD_VERTEX,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D colorTexture;
      uniform vec2 invSize;
      uniform vec2 direction;
      uniform float centerWeight;
      uniform float gaussianOffsets[KERNEL_PAIRS];
      uniform float gaussianWeights[KERNEL_PAIRS];
      void main() {
        vec3 sum = texture2D(colorTexture, vUv).rgb * centerWeight;
        for (int i = 0; i < KERNEL_PAIRS; i++) {
          vec2 offset = direction * invSize * gaussianOffsets[i];
          sum += (texture2D(colorTexture, vUv + offset).rgb + texture2D(colorTexture, vUv - offset).rgb) * gaussianWeights[i];
        }
        gl_FragColor = vec4(sum, 1.0);
      }
    `,
  })
}

/** UnrealBloomPass's composite over the mips kept, with their original weights. */
function compositeMaterial(factors: readonly number[]): ShaderMaterial {
  const uniforms: Record<string, { value: unknown }> = {
    uStrength: { value: 0.8 },
    uRadius: { value: 0.4 },
  }
  factors.forEach((_, i) => (uniforms[`uBlur${i}`] = { value: null }))
  const declarations = factors.map((_, i) => `uniform sampler2D uBlur${i};`).join('\n')
  const terms = factors
    .map((f, i) => `lerpBloomFactor(${f.toFixed(2)}) * texture2D(uBlur${i}, vUv).rgb`)
    .join(' +\n')
  return new ShaderMaterial({
    uniforms,
    vertexShader: QUAD_VERTEX,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uStrength;
      uniform float uRadius;
      ${declarations}
      float lerpBloomFactor(const in float factor) {
        return mix(factor, 1.2 - factor, uRadius);
      }
      void main() {
        // 3.0 as in UnrealBloomPass (its alpha-based intensity, kept for the same strength).
        vec3 bloom = 3.0 * uStrength * (${terms});
        gl_FragColor = vec4(bloom, max(bloom.r, max(bloom.g, bloom.b)));
      }
    `,
  })
}
