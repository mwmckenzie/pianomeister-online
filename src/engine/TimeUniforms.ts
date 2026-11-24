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
  /**
   * Song ticks a layer draws, [uClipLo, uClipHi): notes starting before uClipLo are left out,
   * anything at or past uClipHi is cut. Open (±1e9) except while the loop repeat draws
   * (milestone 9.2): the song is cut at the loop end, and each repeat shows one iteration.
   */
  uClipLo: IUniform<number>
  uClipHi: IUniform<number>
  /** The loop's practice section [start, end) in song ticks, and one iteration's period. */
  uLoopStart: IUniform<number>
  uLoopEnd: IUniform<number>
  uLoopPeriod: IUniform<number>
  /** 1 while the repeat shows beyond the loop end: static surfaces map ticks back (loopSongTick). */
  uLoopRepeat: IUniform<number>
  /** How strongly everything outside the practice section is dimmed (0: not at all, no loop). */
  uLoopDim: IUniform<number>
  /**
   * The playlist crossfade band (milestone 9.5): ticks where both songs sound, and the ending
   * song's deck (-1: no band). Its notes dim through the band as its audio fades.
   */
  uBandStart: IUniform<number>
  uBandEnd: IUniform<number>
  uBandDeck: IUniform<number>
}
