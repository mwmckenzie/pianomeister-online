// @vitest-environment node
import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { beveledBox } from './beveledBox'
import { buildBevelTemplate } from './buildBevelTemplate'
import type { EdgeProfile } from './EdgeProfile'

const PROFILES: readonly EdgeProfile[] = ['none', 'chamfer', 'rounded']

function bounds(width: number, height: number, depth: number, profile: EdgeProfile, r: number) {
  const g = beveledBox(width, height, depth, profile, r)
  g.computeBoundingBox()
  return (g.boundingBox as Box3).getSize(new Vector3())
}

/**
 * How far the top face reaches toward +x: the top face is where vertices have y at the top;
 * the bevel is the distance from there to the box side.
 */
function topBevelWidth(width: number, depth: number, profile: EdgeProfile, r: number): number {
  const g = beveledBox(width, 1, depth, profile, r)
  const p = g.getAttribute('position')
  let reach = -Infinity
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) - 0.5) < 1e-6) reach = Math.max(reach, p.getX(i))
  }
  return width / 2 - reach
}

describe('beveledBox', () => {
  it('has exactly the requested outer size for every profile', () => {
    for (const profile of PROFILES) {
      const size = bounds(0.94, 0.6, 6.38, profile, 0.04)
      expect(size.x).toBeCloseTo(0.94, 6)
      expect(size.y).toBeCloseTo(0.6, 6)
      expect(size.z).toBeCloseTo(6.38, 6)
    }
  })

  it('keeps the bevel the same world size however long the box is', () => {
    for (const profile of ['chamfer', 'rounded'] as const) {
      const short = topBevelWidth(1, 0.2, profile, 0.06)
      const long = topBevelWidth(1, 20, profile, 0.06)
      expect(short).toBeCloseTo(0.06, 6)
      expect(long).toBeCloseTo(0.06, 6)
    }
    expect(topBevelWidth(1, 5, 'none', 0.06)).toBeCloseTo(0, 6)
  })

  it('clamps the radius on thin boxes so opposite bevels never meet', () => {
    const size = bounds(1, 0.05, 1, 'rounded', 0.5)
    expect(size.y).toBeCloseTo(0.05, 6)
    expect(topBevelWidth(1, 1, 'chamfer', 2)).toBeLessThan(0.5)
  })

  it('makes a chamfer a single flat 45° cut on each edge', () => {
    // Every vertex on the +x/+y edge region lies on the plane x + y = const (no extra facets).
    const g = beveledBox(2, 2, 2, 'chamfer', 0.2)
    const p = g.getAttribute('position')
    const sums: number[] = []
    for (let i = 0; i < p.count; i++) {
      const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)]
      // The +x/+y edge: from the inner corners (x, y ≥ 0.8) along z, excluding the box corners.
      const onEdge = x >= 0.8 - 1e-6 && y >= 0.8 - 1e-6 && x + y > 1.6 + 1e-6
      if (onEdge && Math.abs(z) <= 0.8 + 1e-6) sums.push(x + y)
    }
    expect(sums.length).toBeGreaterThan(0)
    expect(sums.every((sum) => Math.abs(sum - 1.8) < 1e-5)).toBe(true)
  })

  it('has unit normals; rounded normals point outward from the inner corner', () => {
    for (const profile of PROFILES) {
      const t = buildBevelTemplate(profile)
      for (let i = 0; i < t.vertexCount; i++) {
        const n = new Vector3().fromArray(t.normal, i * 3)
        expect(n.length()).toBeCloseTo(1, 6)
      }
    }
    const r = buildBevelTemplate('rounded')
    const n = new Vector3().fromArray(r.normal, 0)
    const o = new Vector3().fromArray(r.offset, 0).normalize()
    expect(n.distanceTo(o)).toBeCloseTo(0, 6)
  })
})
