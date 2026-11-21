import {
  type Camera,
  Color,
  HalfFloatType,
  type Scene,
  type Texture,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { Pass } from 'three/addons/postprocessing/Pass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

import { GLOW_LAYER } from '../GLOW_LAYER'

const BLACK = new Color(0, 0, 0)

/**
 * Selective bloom (brief decision 109): draws only the glow layer (glow twins: emitters, plus
 * keys and heads as black occluders) into its own half-float target at `scale` × the drawing
 * buffer, then blurs it with three's UnrealBloomPass. It leaves the composer's buffers alone;
 * the mix pass adds `bloomTexture` — the blur only, never the glow layer itself, so an element
 * keeps its own brightness and gains a halo.
 */
export class SelectiveBloomPass extends Pass {
  private readonly glowTarget: WebGLRenderTarget
  private readonly bloom: UnrealBloomPass
  private width = 1
  private height = 1
  private scale = 0.5

  constructor(
    private readonly scene: Scene,
    private readonly camera: Camera,
  ) {
    super()
    this.needsSwap = false
    this.glowTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.8, 0.4, 0.1)
  }

  /** The blurred glow, for the mix pass. */
  get bloomTexture(): Texture {
    return this.bloom.renderTargetsHorizontal[0]?.texture ?? this.glowTarget.texture
  }

  configure(scale: number, strength: number, radius: number, threshold: number): void {
    this.bloom.strength = strength
    this.bloom.radius = radius
    this.bloom.threshold = threshold
    if (scale !== this.scale) {
      this.scale = scale
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
    const background = this.scene.background
    const layers = this.camera.layers.mask
    const clearColor = renderer.getClearColor(new Color())
    const clearAlpha = renderer.getClearAlpha()
    const autoClear = renderer.autoClear
    this.scene.background = null
    this.camera.layers.set(GLOW_LAYER)
    renderer.autoClear = true
    renderer.setClearColor(BLACK, 1)
    renderer.setRenderTarget(this.glowTarget)
    renderer.render(this.scene, this.camera)
    this.camera.layers.mask = layers
    this.scene.background = background
    renderer.setClearColor(clearColor, clearAlpha)
    renderer.autoClear = autoClear
    // UnrealBloomPass reads `readBuffer` and finally blends onto it; the target is ours, so that
    // last blend is harmless (and cheap at this size).
    this.bloom.render(renderer, this.glowTarget, this.glowTarget, 0, false)
  }

  override dispose(): void {
    this.glowTarget.dispose()
    this.bloom.dispose()
  }
}
