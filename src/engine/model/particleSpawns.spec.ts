// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { PARTICLE_KINDS } from './PARTICLE_KINDS'
import { flashSpawn, onsetSpawns, sustainSpawn } from './particleSpawns'

const ONE = { size: 1, count: 1, lifetime: 1, spread: 1 }
const half = () => 0.5

describe('onsetSpawns', () => {
  it('keeps the milestone 8 sparks at factor 1: 8 sparks, 0.3–0.6 s, rising', () => {
    const sparks = onsetSpawns('sparks', 1, ONE, 1, Math.random)
    expect(sparks).toHaveLength(8)
    for (const s of sparks) {
      expect(s.kind).toBe('spark')
      expect(s.life).toBeGreaterThanOrEqual(0.3)
      expect(s.life).toBeLessThanOrEqual(0.6)
      expect(s.vy).toBeGreaterThanOrEqual(3)
      expect(s.size).toBeGreaterThanOrEqual(0.25)
      expect(s.size).toBeLessThanOrEqual(0.45)
    }
    expect(PARTICLE_KINDS.spark.gravity).toBe(-14)
  })

  it('scales count and size with velocity and the knobs; at least one particle', () => {
    expect(onsetSpawns('sparks', 1, ONE, 1.7, half)).toHaveLength(14)
    expect(onsetSpawns('sparks', 1, { ...ONE, count: 2 }, 1, half)).toHaveLength(16)
    expect(onsetSpawns('sparks', 1, { ...ONE, count: 0.01 }, 1, half)).toHaveLength(1)
    const big = onsetSpawns('sparks', 1, { ...ONE, size: 2 }, 1, half)[0]!
    expect(big.size).toBeCloseTo(0.7)
  })

  it('stretches lifetime and spread', () => {
    const slow = onsetSpawns('sparks', 1, { ...ONE, lifetime: 2 }, 1, half)[0]!
    expect(slow.life).toBeCloseTo(0.9)
    const wide = onsetSpawns('glitter', 1, { ...ONE, spread: 0 }, 1, () => 0)[0]!
    expect(wide.vx).toBeCloseTo(-0) // spread 0 keeps them on the key's line
  })

  it('makes an explosion of one ring plus debris all around', () => {
    const parts = onsetSpawns('explosion', 1, ONE, 1, half)
    expect(parts.filter((p) => p.kind === 'ring')).toHaveLength(1)
    const debris = parts.filter((p) => p.kind === 'debris')
    expect(debris).toHaveLength(10)
    expect(new Set(debris.map((d) => Math.sign(Math.round(d.vx * 100)))).size).toBeGreaterThan(1)
  })

  it('emits within the key width', () => {
    for (const effect of ['sparks', 'flame', 'glitter', 'scalingSparks'] as const) {
      for (const p of onsetSpawns(effect, 0.6, ONE, 1, Math.random)) {
        expect(Math.abs(p.dx)).toBeLessThanOrEqual(0.6 * 0.3 * 1.4 + 1e-9)
      }
    }
  })
})

describe('sustainSpawn', () => {
  it('rises for embers, flames and smoke', () => {
    for (const effect of ['embers', 'flames', 'smoke'] as const) {
      const p = sustainSpawn(effect, 1, ONE, 1, half)
      expect(p.vy).toBeGreaterThan(0)
      expect(p.life).toBeGreaterThan(0)
    }
    expect(sustainSpawn('smoke', 1, ONE, 1, half).kind).toBe('smoke')
  })
})

describe('flashSpawn', () => {
  it('is still (reduced motion)', () => {
    const f = flashSpawn(1, ONE)
    expect([f.vx, f.vy, f.vz]).toEqual([0, 0, 0])
    expect(PARTICLE_KINDS.flash.gravity).toBe(0)
  })
})
