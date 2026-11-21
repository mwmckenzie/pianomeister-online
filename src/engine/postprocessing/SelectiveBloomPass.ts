import {
  type Camera,
  Color,
  HalfFloatType,
  type Scene,
  type Texture,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { Pass } from 'three/addons/postprocessing/Pass.js'

import { BloomChain } from './BloomChain'

const BLACK = new Color(0, 0, 0)

/**
 * Selective bloom (brief decision 109): draws the glow scene (glow twins only: emitters, plus
 * keys and heads as black occluders) into its own half-float target at `scale` × the drawing
 * buffer, then blurs it (BloomChain: UnrealBloomPass's blur, with fewer mips at lower scales).
 * It leaves the composer's buffers alone; the mix pass adds `bloomTexture` — the blur only,
 * never the glow scene itself, so an element keeps its own brightness and gains a halo.
 */
export class SelectiveBloomPass extends Pass {
  private readonly glowTarget: WebGLRenderTarget
  private readonly bloom = new BloomChain()
  private width = 1
  private height = 1
  private scale = 0.5

  constructor(
    /** Only the glow twins: a small scene, so this pass doesn't walk the main one. */
    private readonly glowScene: Scene,
    private readonly camera: Camera,
  ) {
    super()
    this.needsSwap = false
    this.glowTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
    this.bloom.setSkip(skipFor(this.scale))
  }

  /** The blurred glow, for the mix pass. */
  get bloomTexture(): Texture {
    return this.bloom.texture
  }

  configure(scale: number, strength: number, radius: number, threshold: number): void {
    this.bloom.strength = strength
    this.bloom.radius = radius
    this.bloom.threshold = threshold
    if (scale !== this.scale) {
      this.scale = scale
      this.bloom.setSkip(skipFor(scale))
      this.setSize(this.width, this.height)
    }
  }

  override setSize(width: number, height: number): void {
    this.width = width
    this.height = height
    const w = Math.max(1, Math.round(width * this.scale))
    const h = Math.max(1, Math.round(height * this.scale))
    this.glowTarget.setSize(w, h)
    this.bloom.setSize(w, h)
  }

  override render(renderer: WebGLRenderer): void {
    const clearColor = renderer.getClearColor(new Color())
    const clearAlpha = renderer.getClearAlpha()
    const autoClear = renderer.autoClear
    renderer.autoClear = true
    renderer.setClearColor(BLACK, 1)
    renderer.setRenderTarget(this.glowTarget)
    renderer.render(this.glowScene, this.camera)
    renderer.setClearColor(clearColor, clearAlpha)
    renderer.autoClear = autoClear
    this.bloom.render(renderer, this.glowTarget.texture)
  }

  override dispose(): void {
    this.glowTarget.dispose()
    this.bloom.dispose()
  }
}

/**
 * Mips to drop so the blur keeps the same on-screen sizes: none at full scale, the sharpest
 * at ½ (its first mip is full scale's second), two at ¼.
 */
function skipFor(scale: number): number {
  return scale >= 1 ? 0 : scale >= 0.5 ? 1 : 2
}
