import type { PlayerSettings } from './PlayerSettings'
import type { QualityPreset } from './QualityPreset'

type Render = PlayerSettings['render']

/** The cost settings a quality preset sets. */
export type QualityCost = Pick<Render, 'bloomResolution' | 'particleBudget' | 'shaderDetail'>

/**
 * What each quality preset sets (brief decision 110). Off is the pre-milestone-9 pipeline: no
 * bloom passes, the old 512-spark pool and the cheapest shaders.
 */
export const QUALITY_PRESETS: { readonly [P in QualityPreset]: QualityCost } = {
  off: { bloomResolution: 'off', particleBudget: 512, shaderDetail: 'minimal' },
  low: { bloomResolution: 'quarter', particleBudget: 1024, shaderDetail: 'low' },
  medium: { bloomResolution: 'half', particleBudget: 2048, shaderDetail: 'medium' },
  high: { bloomResolution: 'full', particleBudget: 4096, shaderDetail: 'high' },
}
