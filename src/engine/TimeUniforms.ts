import type { IUniform } from 'three'

/** Uniforms shared by every scrolling material: one update per frame moves them all. */
export interface TimeUniforms {
  [name: string]: IUniform<number>
  uTick: IUniform<number>
  uUnitsPerTick: IUniform<number>
  uNowZ: IUniform<number>
  uLookAheadTicks: IUniform<number>
}
