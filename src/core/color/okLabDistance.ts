type Lab = readonly [number, number, number]

function linear(channel: number): number {
  const v = channel / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** #RRGGBB in OKLab (Björn Ottosson's matrices). */
function okLab(hex: string): Lab {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = linear((n >> 16) & 0xff)
  const g = linear((n >> 8) & 0xff)
  const b = linear(n & 0xff)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** How different two #RRGGBB colours look: OKLab ΔE × 100 (black to white is 100). */
export function okLabDistance(a: string, b: string): number {
  const p = okLab(a)
  const q = okLab(b)
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}
