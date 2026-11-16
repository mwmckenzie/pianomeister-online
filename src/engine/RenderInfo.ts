/** What the renderer actually draws at, for the settings readout. */
export interface RenderInfo {
  /** Drawing-buffer size in device pixels. */
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
  readonly antialias: 'off' | 'msaa' | 'fxaa' | 'smaa'
}
