import { BufferAttribute, BufferGeometry } from 'three'

import { buildBevelTemplate } from './buildBevelTemplate'
import type { EdgeProfile } from './EdgeProfile'

/**
 * A width × height × depth box centred on the origin with all twelve edges cut by `profile`
 * at radius `r` (clamped to 45% of the shortest side so opposite bevels never meet).
 */
export function beveledBox(
  width: number,
  height: number,
  depth: number,
  profile: EdgeProfile,
  r: number,
): BufferGeometry {
  const template = buildBevelTemplate(profile)
  const radius = profile === 'none' ? 0 : Math.min(r, 0.45 * Math.min(width, height, depth))
  const half = [width / 2 - radius, height / 2 - radius, depth / 2 - radius]
  const position = new Float32Array(template.vertexCount * 3)
  for (let i = 0; i < position.length; i++) {
    position[i] =
      (template.corner[i] as number) * (half[i % 3] as number) +
      (template.offset[i] as number) * radius
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('normal', new BufferAttribute(template.normal.slice(), 3))
  return geometry
}
