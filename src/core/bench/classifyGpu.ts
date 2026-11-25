export type GpuClass = 'software' | 'weak' | 'mainstream' | 'strong' | 'unknown'

export interface GpuVerdict {
  readonly gpuClass: GpuClass
  /** The rule that matched, for the report. */
  readonly rule: string
}

/** First match wins. Nothing is guessed strong: what no rule knows is unknown. */
const RULES: readonly (readonly [RegExp, GpuClass, string])[] = [
  [/swiftshader|subzero/i, 'software', 'SwiftShader'],
  [/llvmpipe|softpipe/i, 'software', 'Mesa software renderer'],
  [/basic render|\bwarp\b/i, 'software', 'Microsoft Basic Render / WARP'],
  [/software/i, 'software', 'software renderer'],
  [/\biris\b.{0,6}(xe|plus)/i, 'mainstream', 'Intel Iris Xe / Plus'],
  [/\barc\b.{0,6}\b[ab]\d{3}/i, 'strong', 'Intel Arc A / B series'],
  [/\barc\b/i, 'mainstream', 'Intel Arc, integrated'],
  [/\biris\b/i, 'weak', 'Intel Iris (older)'],
  [/\buhd\b/i, 'weak', 'Intel UHD'],
  [/\bhd graphics\b/i, 'weak', 'Intel HD'],
  [/\b(rtx|gtx)\b/i, 'strong', 'GeForce GTX / RTX'],
  [/radeon.{0,8}\brx\b \d/i, 'strong', 'Radeon RX'],
  [/radeon|vega/i, 'mainstream', 'Radeon / Vega, integrated or older'],
  [/adreno.{0,8} [345]\d\d/i, 'weak', 'Adreno 3xx–5xx'],
  [/adreno.{0,8} [678]\d\d/i, 'mainstream', 'Adreno 6xx and later'],
  [/mali-(4|t)\d/i, 'weak', 'Mali 4xx / T'],
  [/mali-g(3\d|5[0-2])\b/i, 'weak', 'Mali G3x / G5x'],
  [/mali|immortalis/i, 'mainstream', 'Mali G'],
  [/powervr/i, 'weak', 'PowerVR'],
  [/apple m\d/i, 'mainstream', 'Apple M'],
  [/apple a(7|8|9|10|11)\b/i, 'weak', 'Apple A11 and earlier'],
  [/apple a\d\d/i, 'mainstream', 'Apple A12 and later'],
  [/apple gpu/i, 'unknown', 'Apple, model hidden'],
]

/** A renderer string (`WEBGL_debug_renderer_info`) as a class of GPU. */
export function classifyGpu(renderer: string | null): GpuVerdict {
  if (renderer === null || renderer.trim() === '') {
    return { gpuClass: 'unknown', rule: 'no renderer string' }
  }
  for (const [pattern, gpuClass, rule] of RULES) {
    if (pattern.test(renderer)) return { gpuClass, rule }
  }
  return { gpuClass: 'unknown', rule: 'no rule matches' }
}
