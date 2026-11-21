import type { IUniform } from 'three'

/** Uniforms shared by every scrolling material: one update per frame moves them all. */
export interface TimeUniforms {
  [name: string]: IUniform<number>
  uTick: IUniform<number>
  uUnitsPerTick: IUniform<number>
  uNowZ: IUniform<number>
  uLookAheadTicks: IUniform<number>
  /**
   * Animation clock in seconds (brief decision 119): wall-clock time from the frame timestamps,
   * still while frozen and under reduced motion.
   */
  uTime: IUniform<number>
  /** How fast the song moves now (ticks per second, smoothed; 0 while paused). */
  uTicksPerSecond: IUniform<number>
  /** Tick the position last jumped to (seek, loop wrap): no pulses for notes started before. */
  uJumpTick: IUniform<number>
  /** 1 under reduced motion: no flicker, breathing, drift or noise animation. */
  uReducedMotion: IUniform<number>
}
