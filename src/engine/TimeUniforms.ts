import type { IUniform } from 'three'

/** Uniforms shared by every scrolling material: one update per frame moves them all. */
export interface TimeUniforms {
  [name: string]: IUniform<number>
  uTick: IUniform<number>
  uUnitsPerTick: IUniform<number>
  uNowZ: IUniform<number>
  uLookAheadTicks: IUniform<number>
  /**
   * Wall clock in seconds (brief decision 119), from the frame timestamps: what transients age
   * by (particles in flight), so they finish even while paused.
   */
  uTime: IUniform<number>
  /**
   * Loop clock in seconds: what looping animation runs on (flicker, smoke, stripe drift,
   * breathing). It advances only while playing, so a paused frame holds still.
   */
  uLoopTime: IUniform<number>
  /** Wall-clock seconds since playback paused (0 while playing): pulses finish fading. */
  uPausedFor: IUniform<number>
  /** How fast the song moves now (ticks per second, smoothed; 0 while paused). */
  uTicksPerSecond: IUniform<number>
  /** Tick the position last jumped to (seek, loop wrap): no pulses for notes started before. */
  uJumpTick: IUniform<number>
  /** 1 under reduced motion: no flicker, breathing, drift or noise animation. */
  uReducedMotion: IUniform<number>
}
