import { BoxGeometry, Vector3 } from 'three'

import type { BevelTemplate } from './BevelTemplate'
import type { EdgeProfile } from './EdgeProfile'

const ROUNDED_SEGMENTS = 4
const cache = new Map<EdgeProfile, BevelTemplate>()

/**
 * Builds (once per profile) the size-independent template of a beveled box, the same way
 * three's RoundedBoxGeometry rounds a subdivided unit box: every vertex hangs off its inner
 * corner by a direction. Normalising that direction by length (L2) gives quarter-round edges;
 * normalising by |x|+|y|+|z| (L1) puts the edge vertices on one plane, a flat 45° chamfer.
 * 'none' is a plain box (zero offsets).
 */
export function buildBevelTemplate(profile: EdgeProfile): BevelTemplate {
  const cached = cache.get(profile)
  if (cached !== undefined) return cached
  const segments = profile === 'rounded' ? ROUNDED_SEGMENTS : 1
  const total = profile === 'none' ? 1 : segments * 2 + 1
  const box = new BoxGeometry(1, 1, 1, total, total, total).toNonIndexed()
  const source = box.getAttribute('position')
  const count = source.count
  const corner = new Float32Array(count * 3)
  const offset = new Float32Array(count * 3)
  const half = 0.5 / total
  const p = new Vector3()
  const d = new Vector3()
  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(source, i)
    const sign = [Math.sign(p.x), Math.sign(p.y), Math.sign(p.z)] as const
    corner.set(sign, i * 3)
    if (profile === 'none') continue
    d.set(p.x - sign[0] * half, p.y - sign[1] * half, p.z - sign[2] * half)
    const norm = profile === 'rounded' ? d.length() : Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z)
    d.divideScalar(norm)
    offset.set([d.x, d.y, d.z], i * 3)
  }
  box.dispose()
  const template: BevelTemplate = {
    corner,
    offset,
    normal: templateNormals(profile, corner, offset, count),
    vertexCount: count,
  }
  cache.set(profile, template)
  return template
}

/**
 * Rounded: the offset direction is the surface normal. Chamfer and none: flat facets, so the
 * face normal of each triangle. Facet normals survive stretching the box: flat faces stay
 * axis-aligned, edge chamfers only stretch along their own edge, and corner facets keep the
 * bevel size.
 */
function templateNormals(
  profile: EdgeProfile,
  corner: Float32Array,
  offset: Float32Array,
  count: number,
): Float32Array {
  const normal = new Float32Array(count * 3)
  if (profile === 'rounded') {
    const n = new Vector3()
    for (let i = 0; i < count; i++) {
      n.fromArray(offset, i * 3).normalize()
      normal.set([n.x, n.y, n.z], i * 3)
    }
    return normal
  }
  // Realise at half size 1 with r = 0.5 and take each triangle's face normal.
  const r = profile === 'none' ? 0 : 0.5
  const at = (i: number) =>
    new Vector3(
      (corner[i * 3] as number) * (1 - r) + (offset[i * 3] as number) * r,
      (corner[i * 3 + 1] as number) * (1 - r) + (offset[i * 3 + 1] as number) * r,
      (corner[i * 3 + 2] as number) * (1 - r) + (offset[i * 3 + 2] as number) * r,
    )
  for (let t = 0; t < count; t += 3) {
    const a = at(t)
    const face = at(t + 1)
      .sub(a)
      .cross(at(t + 2).sub(a))
    // Corner triangles of the subdivided box can collapse to nothing; any normal will do.
    if (face.lengthSq() < 1e-12) face.set(0, 1, 0)
    face.normalize()
    for (let k = 0; k < 3; k++) normal.set([face.x, face.y, face.z], (t + k) * 3)
  }
  return normal
}
