import type { PlayerSettings } from '@/core/settings/PlayerSettings'
import { textColorOn } from '@/core/color/textColorOn'

/** "#8AB4FF" → "138 180 255", for rgb(var(--primary-rgb) / α). */
function rgbTriplet(hex: string): string {
  const v = Number.parseInt(hex.slice(1, 7), 16)
  return `${(v >> 16) & 0xff} ${(v >> 8) & 0xff} ${v & 0xff}`
}

/**
 * Writes the Appearance settings into the design tokens on <html> (decisions 52–54).
 * `reducedMotion` is the system preference, used when motion follows the system.
 */
export function applyTheme(
  appearance: PlayerSettings['appearance'],
  reducedMotion: boolean,
  root: HTMLElement = document.documentElement,
): void {
  const style = root.style
  style.setProperty('--primary', appearance.primary)
  style.setProperty('--primary-rgb', rgbTriplet(appearance.primary))
  style.setProperty('--on-primary', textColorOn(appearance.primary))
  style.setProperty('--secondary', appearance.secondary)
  style.setProperty('--secondary-rgb', rgbTriplet(appearance.secondary))
  style.setProperty('--glass-alpha', String(appearance.panelOpacity))
  style.setProperty('--glass-blur', `${appearance.blur}px`)
  root.dataset.glassBlur = String(appearance.blur)
  const reduced =
    appearance.motion === 'reduced' || (appearance.motion === 'system' && reducedMotion)
  root.dataset.motion = reduced ? 'reduced' : 'full'
}
