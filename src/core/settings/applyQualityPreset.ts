import type { PlayerSettings } from './PlayerSettings'
import { QUALITY_PRESETS } from './QUALITY_PRESETS'
import type { QualityPreset } from './QualityPreset'

type Render = PlayerSettings['render']

/** The render settings with a preset chosen and its cost settings applied. */
export function applyQualityPreset(render: Render, preset: QualityPreset): Render {
  return { ...render, quality: preset, ...QUALITY_PRESETS[preset] }
}

/** True when a cost setting was changed after the preset was chosen ("Medium · modified"). */
export function isQualityModified(render: Render): boolean {
  const cost = QUALITY_PRESETS[render.quality]
  return (
    render.bloomResolution !== cost.bloomResolution ||
    render.particleBudget !== cost.particleBudget ||
    render.shaderDetail !== cost.shaderDetail
  )
}
