import { LOG_SLIDER_STEPS, logSliderPosition, logSliderValue, snapToStep } from './logSlider'
import type { SettingKey } from './SettingKey'
import { settingDefinition } from './settingValues'

/** The built-in looks' levels (milestone 9.1, section C). */
export type SliderLevel = 'subtle' | 'medium' | 'strong'

/** Share of the slider's travel for each level. */
const SHARE: { readonly [L in SliderLevel]: number } = { subtle: 0.2, medium: 0.5, strong: 0.8 }

/**
 * A number setting's value at 20 / 50 / 80 % of its **slider position**: for a log slider that
 * is the log mapping (with its 0 stop), for a linear one the share of the range; snapped to the
 * step. So "subtle" sits where a fifth of the slider would put the thumb, whatever the scale.
 */
export function sliderLevel(key: SettingKey, level: SliderLevel): number {
  const def = settingDefinition(key)
  if (def.kind !== 'number') throw new TypeError(`${key} is not a number setting`)
  const share = SHARE[level]
  if (def.scale === 'log') return logSliderValue(Math.round(share * LOG_SLIDER_STEPS), def)
  return snapToStep(def.min + (def.max - def.min) * share, def)
}

/** Where a value sits on its slider, 0–1 (the inverse of sliderLevel, for checks). */
export function sliderShare(key: SettingKey, value: number): number {
  const def = settingDefinition(key)
  if (def.kind !== 'number') throw new TypeError(`${key} is not a number setting`)
  if (def.scale === 'log') return logSliderPosition(value, def) / LOG_SLIDER_STEPS
  return (value - def.min) / (def.max - def.min)
}
