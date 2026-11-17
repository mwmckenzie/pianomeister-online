/** Text colours for filled buttons: the app's darkest background tone, or white. */
export const DARK_TEXT = '#0B1020'
export const LIGHT_TEXT = '#FFFFFF'

/**
 * The text colour (dark or light) that contrasts more with a #RRGGBB background, by WCAG 2
 * contrast ratio — keeps primary buttons readable for any menu colour (brief decision 52).
 */
export function textColorOn(background: string): string {
  const bg = relativeLuminance(background)
  const dark = contrast(bg, relativeLuminance(DARK_TEXT))
  const light = contrast(bg, relativeLuminance(LIGHT_TEXT))
  return dark >= light ? DARK_TEXT : LIGHT_TEXT
}

export function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1, 7), 16)
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
}
