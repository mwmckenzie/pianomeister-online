import type { PlayerSettings } from '../settings/PlayerSettings'
import type { SettingKey } from '../settings/SettingKey'
import { restoreValues } from '../settings/settingGroups'
import { readSetting } from '../settings/settingValues'
import { LOOK_KEYS } from './LOOK_KEYS'

const HEX = /^#[0-9a-f]{6}$/i

/**
 * Whether a look key eases across a playlist seam (milestone 9.5 D6, the agreed set): the camera
 * and look-ahead, colours, opacities, glows, bloom strength, vignette and dim strengths. Every
 * other key — fills, styles, toggles, palettes, the keyboard's geometry — switches at the midpoint.
 */
export function eases(key: SettingKey, value: unknown): boolean {
  if (typeof value === 'string') return HEX.test(value)
  if (typeof value !== 'number') return false
  const [section, field = ''] = key.split('.')
  if (section === 'keyboard') return false
  if (section === 'camera' || section === 'colors' || section === 'opacity') return true
  if (key === 'highway.lookAheadBeats' || key === 'highway.vignette') return true
  return /(Glow|Strength|Opacity|Transparency|Intensity)$/i.test(field)
}

/**
 * The look `progress` (0..1) of the way from `from` to `to` across a seam: easing keys
 * interpolate (colours in RGB), the rest switch at the midpoint. Keys that aren't look keys come
 * from `to` (they don't change across a seam).
 */
export function easeSettings(
  from: PlayerSettings,
  to: PlayerSettings,
  progress: number,
): PlayerSettings {
  const t = Math.min(1, Math.max(0, progress))
  if (t >= 1) return to
  const values = new Map<SettingKey, unknown>()
  for (const key of LOOK_KEYS) {
    const a = readSetting(from, key)
    const b = readSetting(to, key)
    if (a === b) continue
    if (typeof a === 'number' && typeof b === 'number' && eases(key, a)) {
      values.set(key, a + (b - a) * t)
    } else if (typeof a === 'string' && typeof b === 'string' && eases(key, a) && HEX.test(b)) {
      values.set(key, mixHex(a, b, t))
    } else {
      values.set(key, t < 0.5 ? a : b)
    }
  }
  return restoreValues(to, values)
}

function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)
  let out = '#'
  for (let i = 0; i < 3; i++) {
    const v = Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t)
    out += v.toString(16).padStart(2, '0').toUpperCase()
  }
  return out
}
