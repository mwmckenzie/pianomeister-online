import type { ThemeColors } from './ThemeColors'

/**
 * The theme's primary and secondary colours from the CSS custom properties: a canvas can't use
 * `var(…)`, so it reads them once per redraw (they change with Appearance → Colours).
 */
export function readThemeColors(element: Element): ThemeColors {
  const style = getComputedStyle(element)
  const triple = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    primary: triple('--primary-rgb', '138 180 255'),
    secondary: triple('--secondary-rgb', '126 224 195'),
    onSecondary: style.getPropertyValue('--on-primary').trim() || '#0b1020',
  }
}
