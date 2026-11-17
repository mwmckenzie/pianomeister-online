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

import type { RenderInfo } from './RenderInfo'

type RenderSettings = PlayerSettings['render']

const MSAA_SAMPLES = 4

/**
 * The renderer and anti-aliasing (brief decision 48). Every material writes display-space
 * colour itself, so the renderer's output colour space is set to linear, which turns off all
 * of three's conversions: colours are identical on the canvas and in render targets, and the
 * anti-aliasing mode can change at runtime without recreating the WebGL context:
 * - off: draw straight to the canvas;
 * - msaa: draw into a multisampled render target, then copy to the canvas;
 * - fxaa / smaa: draw into a render target, then three's FXAA or SMAA pass. Those passes are
 *   loaded on first use (SMAA carries its lookup textures), keeping them out of the main
 *   bundle; the previous mode keeps rendering until the pass has arrived.
 */
export class RenderPipeline {
  readonly renderer: WebGLRenderer
  private composer: EffectComposer | null = null
  private settings: RenderSettings | null = null
  /** Bumped per mode change, so a pass that arrives after a newer change is dropped. */
  private build = 0
  private cssWidth = 1
  private cssHeight = 1

  constructor(
    canvas: HTMLCanvasElement,
    private readonly scene: Scene,
    private readonly camera: Camera,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = LinearSRGBColorSpace
  }

  /** Applies render settings; rebuilds the pass chain only when the anti-aliasing mode changes. */
  configure(settings: RenderSettings): void {
    const modeChanged = this.settings?.antialias !== settings.antialias
    this.settings = settings
    if (modeChanged) this.buildComposer(settings.antialias)
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
  }

  render(): void {
    if (this.composer === null) this.renderer.render(this.scene, this.camera)
    else this.composer.render()
  }

  info(): RenderInfo {
    const canvas = this.renderer.domElement
    return {
      width: canvas.width,
      height: canvas.height,
      pixelRatio: this.renderer.getPixelRatio(),
      antialias: this.settings?.antialias ?? 'off',
    }
  }

  dispose(): void {
    this.disposeComposer()
    this.renderer.dispose()
  }

  private buildComposer(mode: RenderSettings['antialias']): void {
    const build = ++this.build
    if (mode !== 'fxaa' && mode !== 'smaa') {
      this.installComposer(mode, null)
      return
    }
    loadPostPass(mode).then(
      (pass) => {
        if (build !== this.build) pass.dispose()
        else this.installComposer(mode, pass)
      },
      (e: unknown) => console.error(`[render] Couldn't load the ${mode} pass:`, e),
    )
  }

  private installComposer(mode: RenderSettings['antialias'], postPass: Pass | null): void {
    this.disposeComposer()
    if (mode === 'off') return
    const target = new WebGLRenderTarget(1, 1, {
      type: UnsignedByteType,
      samples: mode === 'msaa' ? MSAA_SAMPLES : 0,
    })
    const composer = new EffectComposer(this.renderer, target)
    composer.addPass(new RenderPass(this.scene, this.camera))
    composer.addPass(postPass ?? new ShaderPass(CopyShader))
    this.composer = composer
    this.resize(this.cssWidth, this.cssHeight)
  }

  private disposeComposer(): void {
    if (this.composer === null) return
    for (const pass of this.composer.passes) pass.dispose()
    this.composer.dispose()
    this.composer = null
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
