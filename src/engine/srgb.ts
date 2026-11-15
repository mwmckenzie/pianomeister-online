import { Color, SRGBColorSpace } from 'three'

/**
 * #rrggbb as sRGB components for our ShaderMaterials, which write gl_FragColor without colour
 * management, so the exact palette hex values reach the screen.
 */
export function srgb(hex: string): Color {
  const out = new Color()
  new Color(hex).getRGB(out, SRGBColorSpace)
  return out
}
