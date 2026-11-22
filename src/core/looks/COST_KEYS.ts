import type { SettingKey } from '../settings/SettingKey'

/**
 * Device-cost settings (brief decision 121): the quality preset and what it sets, and the
 * resolution settings. They stay per device — a look made at High on a PC never pushes High
 * onto an iPad — so a look never stores, exports or applies them.
 */
export const COST_KEYS: ReadonlySet<SettingKey> = new Set<SettingKey>([
  'render.quality',
  'render.bloomResolution',
  'render.particleBudget',
  'render.shaderDetail',
  'render.scaleAuto',
  'render.scale',
  'render.maxPixelRatio',
  'render.antialias',
])
