import {
  type Camera,
  LinearSRGBColorSpace,
  type Scene,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { Pass } from 'three/addons/postprocessing/Pass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { CopyShader } from 'three/addons/shaders/CopyShader.js'

import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import type { GpuInfo } from './GpuInfo'
import { GpuTimer } from './GpuTimer'
import { createMixPass } from './postprocessing/createMixPass'
import { SelectiveBloomPass } from './postprocessing/SelectiveBloomPass'
import type { RenderInfo } from './RenderInfo'

type RenderSettings = PlayerSettings['render']
type Antialias = RenderSettings['antialias']

const MSAA_SAMPLES = 4

const BLOOM_SCALE: { readonly [R in RenderSettings['bloomResolution']]: number } = {
  off: 0,
  quarter: 0.25,
  half: 0.5,
  full: 1,
}

/** What the pass chain is built from; a change rebuilds it. */
interface Chain {
  readonly antialias: Antialias
  readonly bloom: boolean
  readonly mix: boolean
}

/**
 * The renderer, anti-aliasing (brief decision 48) and selective bloom (decision 109). Every
 * material writes display-space colour itself, so the renderer's output colour space is set to
 * linear, which turns off all of three's conversions: colours are identical on the canvas and
 * in render targets, and the chain can change at runtime without recreating the WebGL context.
 * - nothing to post-process (no anti-aliasing pass, no bloom, no vignette): straight to the
 *   canvas — with Off and the Classic look this is exactly the milestone 8 pipeline;
 * - msaa: draw into a multisampled render target, then copy (or mix) to the canvas;
 * - fxaa / smaa: draw into a render target, then three's FXAA or SMAA pass. Those passes are
 *   loaded on first use (SMAA carries its lookup textures), keeping them out of the main
 *   bundle; the previous chain keeps rendering until the pass has arrived;
 * - bloom: the glow scene is drawn and blurred first (SelectiveBloomPass), and a mix pass
 *   adds the blur and the vignette after the main pass.
 */
export class RenderPipeline {
  readonly renderer: WebGLRenderer
  private composer: EffectComposer | null = null
  private bloomPass: SelectiveBloomPass | null = null
  private mixPass: ShaderPass | null = null
  private settings: RenderSettings | null = null
  private vignette = 0
  private chain: Chain | null = null
  /** Bumped per chain change, so a pass that arrives after a newer change is dropped. */
  private build = 0
  private cssWidth = 1
  private cssHeight = 1
  private readonly halfFloat: boolean
  private readonly gpu: GpuTimer

  constructor(
    canvas: HTMLCanvasElement,
    private readonly scene: Scene,
    /** The glow twins (brief decision 109), drawn by the bloom pass. */
    private readonly glowScene: Scene,
    private readonly camera: Camera,
    /** Drawn last, straight onto the screen with no depth: note-name labels (milestone 9.2). */
    private readonly overlayScene: Scene,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      // Notes mask the cages through the stencil buffer (NoteMask).
      stencil: true,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = LinearSRGBColorSpace
    // Counted per frame (all passes), not per render() call.
    this.renderer.info.autoReset = false
    const ext = this.renderer.extensions
    this.halfFloat = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')
    this.gpu = new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext)
  }

  /** Applies render settings and the vignette; rebuilds the pass chain only when its shape changes. */
  configure(settings: RenderSettings, vignette: number): void {
    this.settings = settings
    this.vignette = vignette
    const bloom = this.bloomOn()
    const chain: Chain = { antialias: settings.antialias, bloom, mix: bloom || vignette > 0 }
    const old = this.chain
    if (
      old === null ||
      old.antialias !== chain.antialias ||
      old.bloom !== chain.bloom ||
      old.mix !== chain.mix
    ) {
      this.chain = chain
      this.buildComposer(chain)
    }
    this.applyLook()
    this.resize(this.cssWidth, this.cssHeight)
  }

  /** The pixel ratio from the settings: device pixel ratio or a fixed scale, capped. */
  pixelRatio(): number {
    const s = this.settings
    const device = window.devicePixelRatio || 1
    if (s === null) return Math.min(device, 2)
    return Math.min(s.scaleAuto ? device : s.scale, s.maxPixelRatio)
  }

  /** Sizes the drawing buffer for a canvas of `width` × `height` CSS pixels. */
  resize(width: number, height: number): void {
    this.cssWidth = Math.max(1, width)
    this.cssHeight = Math.max(1, height)
    const ratio = this.pixelRatio()
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(this.cssWidth, this.cssHeight, false)
    if (this.composer !== null) {
      this.composer.setPixelRatio(ratio)
      this.composer.setSize(this.cssWidth, this.cssHeight)
    }
    const aspect = this.uniform('uAspect')
    if (aspect) aspect.value = this.cssWidth / this.cssHeight
  }

  /** The overlay over the finished frame (after bloom, vignette and anti-aliasing). */
  private renderOverlay(): void {
    if (!this.overlayScene.children.some((c) => c.visible)) return
    const { renderer } = this
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(null)
    renderer.render(this.overlayScene, this.camera)
    renderer.autoClear = autoClear
  }

  render(): void {
    this.renderer.info.reset()
    this.gpu.begin()
    if (this.composer === null) this.renderer.render(this.scene, this.camera)
    else this.composer.render()
    this.renderOverlay()
    this.gpu.end()
  }

  /** True while the glow scene is drawn: glow twins are shown only then. */
  get bloomActive(): boolean {
    return this.bloomPass !== null
  }

  info(): RenderInfo {
    const canvas = this.renderer.domElement
    const scale = this.bloomPass === null ? 0 : BLOOM_SCALE[this.settings?.bloomResolution ?? 'off']
    return {
      width: canvas.width,
      height: canvas.height,
      pixelRatio: this.renderer.getPixelRatio(),
      antialias: this.settings?.antialias ?? 'off',
      bloom: this.bloomPass !== null ? 'on' : this.bloomWanted() ? 'unavailable' : 'off',
      bloomWidth: Math.round(canvas.width * scale),
      bloomHeight: Math.round(canvas.height * scale),
      gpuMs: this.gpu.averageMs(),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      points: this.renderer.info.render.points,
      programs: this.renderer.info.programs?.length ?? 0,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      targetBytes: this.targetBytes(),
    }
  }

  gpuInfo(): GpuInfo {
    const gl = this.renderer.getContext()
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name: unknown = ext === null ? null : gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    return {
      renderer: typeof name === 'string' ? name : null,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      timer: this.gpu.available,
      floatTargets: this.halfFloat,
    }
  }

  /** Starts the GPU-time mean afresh (a benchmark cell). */
  resetGpuTimer(): void {
    this.gpu.reset()
  }

  /** The drawing buffer (colour, depth and stencil), the composer's two targets, the bloom's. */
  private targetBytes(): number {
    const { width, height } = this.renderer.domElement
    const pixels = width * height
    let bytes = pixels * 8
    if (this.composer !== null) {
      const samples = this.composer.renderTarget1.samples
      bytes += 2 * pixels * (8 + samples * 8)
    }
    return bytes + (this.bloomPass?.targetBytes ?? 0)
  }

  dispose(): void {
    this.disposeComposer()
    this.gpu.dispose()
    this.renderer.dispose()
  }

  private bloomWanted(): boolean {
    return (this.settings?.bloomResolution ?? 'off') !== 'off'
  }

  private bloomOn(): boolean {
    return this.bloomWanted() && this.halfFloat
  }

  private applyLook(): void {
    const s = this.settings
    if (s === null) return
    this.bloomPass?.configure(
      BLOOM_SCALE[s.bloomResolution],
      s.bloomStrength,
      s.bloomRadius,
      s.bloomThreshold,
    )
    const bloom = this.uniform('uBloom')
    if (bloom) bloom.value = this.bloomPass === null ? 0 : 1
    const vignette = this.uniform('uVignette')
    if (vignette) vignette.value = this.vignette
  }

  private uniform(name: string): { value: unknown } | undefined {
    return this.mixPass?.uniforms[name]
  }

  private buildComposer(chain: Chain): void {
    const build = ++this.build
    const { antialias } = chain
    if (antialias !== 'fxaa' && antialias !== 'smaa') {
      this.installComposer(chain, null)
      return
    }
    loadPostPass(antialias).then(
      (pass) => {
        if (build !== this.build) pass.dispose()
        else this.installComposer(chain, pass)
      },
      (e: unknown) => console.error(`[render] Couldn't load the ${antialias} pass:`, e),
    )
  }

  private installComposer(chain: Chain, postPass: Pass | null): void {
    this.disposeComposer()
    if (chain.antialias === 'off' && !chain.mix) return
    const target = new WebGLRenderTarget(1, 1, {
      type: UnsignedByteType,
      samples: chain.antialias === 'msaa' ? MSAA_SAMPLES : 0,
      stencilBuffer: true,
    })
    const composer = new EffectComposer(this.renderer, target)
    if (chain.bloom) {
      this.bloomPass = new SelectiveBloomPass(this.glowScene, this.camera)
      composer.addPass(this.bloomPass)
    }
    composer.addPass(new RenderPass(this.scene, this.camera))
    if (chain.mix) {
      const mix = createMixPass()
      const bloomTexture = mix.uniforms.tBloom
      if (bloomTexture && this.bloomPass !== null) bloomTexture.value = this.bloomPass.bloomTexture
      this.mixPass = mix
      composer.addPass(mix)
    }
    if (postPass !== null) composer.addPass(postPass)
    else if (!chain.mix) composer.addPass(new ShaderPass(CopyShader))
    this.composer = composer
    this.applyLook()
    this.resize(this.cssWidth, this.cssHeight)
  }

  private disposeComposer(): void {
    if (this.composer === null) return
    for (const pass of this.composer.passes) pass.dispose()
    this.composer.dispose()
    this.composer = null
    this.bloomPass = null
    this.mixPass = null
  }
}

/** FXAA or SMAA, loaded on demand. */
async function loadPostPass(mode: 'fxaa' | 'smaa'): Promise<Pass> {
  if (mode === 'fxaa') {
    const { FXAAPass } = await import('three/addons/postprocessing/FXAAPass.js')
    return new FXAAPass()
  }
  const { SMAAPass } = await import('three/addons/postprocessing/SMAAPass.js')
  return new SMAAPass()
}
