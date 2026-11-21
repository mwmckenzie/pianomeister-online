import type { IUniform, Vector2, Vector4 } from 'three'

import { srgb } from '../srgb'
import type { StripeStyle } from './StripeStyle'

const MODE = { note: 0, darker: 1, custom: 2 } as const

/**
 * Writes one use's stripes into its four uniforms, `${prefix}A`, `B` (vec4: colour, mode),
 * `Opacity` (vec2) and `Shape` (vec4: width, balance, angle in radians, drift).
 */
export function writeStripes(
  uniforms: Record<string, IUniform<unknown>>,
  prefix: string,
  style: StripeStyle,
): void {
  const vec4 = (name: string) => uniforms[`${prefix}${name}`]?.value as Vector4 | undefined
  const a = srgb(style.a.color)
  const b = srgb(style.b.color)
  vec4('A')?.set(a.r, a.g, a.b, MODE[style.a.mode])
  vec4('B')?.set(b.r, b.g, b.b, MODE[style.b.mode])
  const opacity = uniforms[`${prefix}Opacity`]?.value as Vector2 | undefined
  opacity?.set(style.aOpacity, style.bOpacity)
  vec4('Shape')?.set(
    style.width,
    style.balance,
    (style.angleDeg * Math.PI) / 180,
    style.drift ? 1 : 0,
  )
}
