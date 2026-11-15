// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CameraPlacement } from './CameraPlacement'
import { cameraFit, FRAME_MARGIN, HIGHWAY_LOOKAHEADS, MAX_HIGHWAY_LENGTH } from './cameraFit'
import { KEYBOARD } from './KEYBOARD'
import { unitsPerTick } from './unitsPerTick'

const FOV = 40
type Vec = { x: number; y: number; z: number }

/** Independent pinhole projection (look-at with world up = +y) into normalized device coords. */
function project(cam: CameraPlacement, aspect: number, p: Vec): { x: number; y: number } {
  const f = normalize(sub(cam.target, cam.position))
  const right = normalize(cross(f, { x: 0, y: 1, z: 0 }))
  const up = cross(right, f)
  const v = sub(p, cam.position)
  const depth = dot(v, f)
  const t = Math.tan((cam.fovDeg * Math.PI) / 180 / 2)
  return { x: dot(v, right) / (depth * t * aspect), y: dot(v, up) / (depth * t) }
}
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const normalize = (a: Vec): Vec => {
  const n = Math.hypot(a.x, a.y, a.z)
  return { x: a.x / n, y: a.y / n, z: a.z / n }
}

const TILTS = [30, 45, 70]
const ASPECTS = [16 / 9, 4 / 3, 21 / 9]
const fit = (tiltDeg: number, aspect: number, distanceOffset = 0, pan = 0) =>
  cameraFit({ tiltDeg, fovDeg: FOV, aspect, distanceOffset, pan })

describe('cameraFit', () => {
  for (const tilt of TILTS) {
    for (const aspect of ASPECTS) {
      describe(`tilt ${tilt}°, aspect ${aspect.toFixed(2)}`, () => {
        const cam = fit(tilt, aspect)

        it('spans the viewport width with the keyboard front edge (within 1%)', () => {
          const left = project(cam, aspect, { x: 0, y: 0, z: 0 })
          const right = project(cam, aspect, { x: KEYBOARD.width, y: 0, z: 0 })
          expect(Math.abs(left.x + 1)).toBeLessThan(0.01)
          expect(Math.abs(right.x - 1)).toBeLessThan(0.01)
        })

        it('puts the front edge on the bottom margin and the highway end on the top margin', () => {
          const front = project(cam, aspect, { x: 26, y: 0, z: 0 })
          const far = project(cam, aspect, { x: 26, y: 0, z: cam.nowZ - cam.highwayLength })
          expect(front.y).toBeCloseTo(-(1 - FRAME_MARGIN), 9)
          expect(far.y).toBeCloseTo(1 - FRAME_MARGIN, 9)
        })

        it('splits the visible highway 2:1 between the look-ahead and the haze zone', () => {
          expect(cam.highwayLength).toBeCloseTo(HIGHWAY_LOOKAHEADS * cam.lookAheadLength, 9)
          const now = project(cam, aspect, { x: 26, y: 0, z: cam.nowZ })
          const oneX = project(cam, aspect, { x: 26, y: 0, z: cam.nowZ - cam.lookAheadLength })
          // The 1x point is strictly inside the screen: above the now line, below the top margin.
          expect(oneX.y).toBeGreaterThan(now.y)
          expect(oneX.y).toBeLessThan(1 - FRAME_MARGIN - 0.01)
        })
      })
    }
  }

  it('maps a note one look-ahead away to the 1x point and 1.5 look-aheads to the far end', () => {
    const cam = fit(45, 16 / 9)
    const lookAheadTicks = 8 * 480
    const scale = unitsPerTick(cam, lookAheadTicks)
    expect(cam.nowZ - lookAheadTicks * scale).toBeCloseTo(cam.nowZ - cam.lookAheadLength, 9)
    expect(cam.nowZ - 1.5 * lookAheadTicks * scale).toBeCloseTo(cam.nowZ - cam.highwayLength, 9)
  })

  it('crops the outer keys at a negative offset and shrinks them at a positive one', () => {
    const aspect = 16 / 9
    const closer = project(fit(45, aspect, -0.3), aspect, { x: KEYBOARD.width, y: 0, z: 0 })
    const farther = project(fit(45, aspect, 0.5), aspect, { x: KEYBOARD.width, y: 0, z: 0 })
    expect(closer.x).toBeGreaterThan(1.3)
    expect(farther.x).toBeLessThan(0.7)
    // The front edge stays on the bottom margin either way.
    expect(project(fit(45, aspect, -0.3), aspect, { x: 26, y: 0, z: 0 }).y).toBeCloseTo(
      -(1 - FRAME_MARGIN),
      9,
    )
  })

  it('keeps the 2:1 split at every offset', () => {
    for (const offset of [-0.5, -0.3, 0.4, 1]) {
      const cam = fit(45, 16 / 9, offset)
      expect(cam.highwayLength).toBeCloseTo(HIGHWAY_LOOKAHEADS * cam.lookAheadLength, 9)
    }
  })

  it('pans the view sideways', () => {
    const aspect = 16 / 9
    const cam = fit(45, aspect, 0, 10)
    expect(cam.position.x).toBe(36)
    expect(project(cam, aspect, { x: 36, y: 0, z: 0 }).x).toBeCloseTo(0, 9)
  })

  it('clamps the highway when the top of the screen looks at the horizon, keeping the split', () => {
    const cam = fit(20, 16 / 9)
    expect(cam.highwayLength).toBe(MAX_HIGHWAY_LENGTH)
    expect(cam.lookAheadLength).toBeCloseTo(MAX_HIGHWAY_LENGTH / HIGHWAY_LOOKAHEADS, 9)
  })

  it('shows less highway at steeper tilts', () => {
    expect(fit(70, 16 / 9).highwayLength).toBeLessThan(fit(45, 16 / 9).highwayLength)
    expect(fit(45, 16 / 9).highwayLength).toBeLessThan(fit(30, 16 / 9).highwayLength)
  })
})
