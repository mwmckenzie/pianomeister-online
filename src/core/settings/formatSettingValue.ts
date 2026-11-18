import type { NumberSetting } from './SettingDefinition'

/** Millimetres per world unit (one white key is 23.5 mm wide). */
export const MM_PER_UNIT = 23.5

/** A number setting's value as shown, e.g. "12 mm", "45°", "22%", "1.70×" (decision 62). */
export function formatSettingValue(def: NumberSetting, value: number): string {
  switch (def.unit) {
    case 'mm': {
      const mm = value * MM_PER_UNIT
      return `${trimZeros(mm.toFixed(Math.abs(mm) >= 9.95 ? 0 : 1))} mm`
    }
    case 'percent':
      return `${Math.round(value * 100)}%`
    case 'wholePercent':
      return `${trimZeros(value.toFixed(def.digits))}%`
    case 'seconds':
      return `${trimZeros(value.toFixed(def.digits))} s`
    case 'deg':
      return `${value.toFixed(def.digits)}°`
    case 'beats':
      return `${trimZeros(value.toFixed(def.digits))} ${value === 1 ? 'beat' : 'beats'}`
    case 'times':
      return `${value.toFixed(def.digits)}×`
    case 'px':
      return `${value.toFixed(def.digits)} px`
    case 'none':
      return value.toFixed(def.digits)
  }
}

/** "5.0" → "5", "1.50" → "1.5", "-0" → "0". */
function trimZeros(text: string): string {
  const out = text.includes('.') ? text.replace(/\.?0+$/, '') : text
  return out === '-0' ? '0' : out
}
