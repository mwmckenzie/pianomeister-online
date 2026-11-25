/** What the WebGL context says about the GPU (the benchmark and the perf overlay). */
export interface GpuInfo {
  /** `WEBGL_debug_renderer_info`, where the browser allows it. */
  readonly renderer: string | null
  readonly maxTextureSize: number
  /** GPU times can be measured. */
  readonly timer: boolean
  /** Half-float targets can be drawn: bloom works. */
  readonly floatTargets: boolean
}
