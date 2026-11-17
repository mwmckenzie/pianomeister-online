import type { RenderInfo } from '@/engine/RenderInfo'

/** What the render-quality readout shows, read from the (non-reactive) engine on demand. */
export interface RenderStatus {
  readonly info: RenderInfo
  readonly frameMs: number
}
