/** What the renderer actually draws at, for the settings readout. */
export interface RenderInfo {
  /** Drawing-buffer size in device pixels. */
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
  readonly antialias: 'off' | 'msaa' | 'fxaa' | 'smaa'
  /** Bloom in use (brief decision 109); 'unavailable' where half-float targets can't be drawn. */
  readonly bloom: 'off' | 'on' | 'unavailable'
  /** Glow-target size in device pixels, while bloom is on. */
  readonly bloomWidth: number
  readonly bloomHeight: number
  /** Mean GPU time per frame, where the browser can measure it. */
  readonly gpuMs: number | null
  /** Draw calls in the last frame, every pass included (the CPU's share of the work). */
  readonly drawCalls: number
}
