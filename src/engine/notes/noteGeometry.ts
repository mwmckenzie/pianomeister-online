import { BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry } from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'

import type { NoteInstance } from '../model/NoteInstance'
import { srgb } from '../srgb'

const PALETTE = PITCH_CLASS_COLORS.map((c) => srgb(c.hex))

/** Unit strip: x across the lane (−0.5..0.5), y along time (0 = start, 1 = end). */
const STRIP = {
  position: new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]),
  index: [0, 1, 2, 0, 2, 3],
}

/**
 * Instanced geometry for notes: per-instance lane (left x, width), ticks (start, end, head end)
 * pitch colour and velocity. With no `shape`, each instance is a unit strip; a shape supplies its own
 * per-vertex attributes (e.g. a bevel template for 3D heads).
 */
export function noteGeometry(
  notes: readonly NoteInstance[],
  shape?: Readonly<Record<string, BufferAttribute>>,
): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry()
  if (shape === undefined) {
    geometry.setAttribute('position', new BufferAttribute(STRIP.position.slice(), 3))
    geometry.setIndex(STRIP.index)
  } else {
    for (const [name, attribute] of Object.entries(shape)) geometry.setAttribute(name, attribute)
  }
  const lane = new Float32Array(notes.length * 2)
  const ticks = new Float32Array(notes.length * 3)
  const color = new Float32Array(notes.length * 3)
  const velocity = new Float32Array(notes.length)
  notes.forEach((n, i) => {
    lane.set([n.x, n.width], i * 2)
    ticks.set([n.startTick, n.endTick, n.headEndTick], i * 3)
    const c = PALETTE[n.colorIndex]
    color.set([c?.r ?? 1, c?.g ?? 1, c?.b ?? 1], i * 3)
    velocity[i] = n.velocity
  })
  geometry.setAttribute('aLane', new InstancedBufferAttribute(lane, 2))
  geometry.setAttribute('aTicks', new InstancedBufferAttribute(ticks, 3))
  geometry.setAttribute('aColor', new InstancedBufferAttribute(color, 3))
  geometry.setAttribute('aVelocity', new InstancedBufferAttribute(velocity, 1))
  geometry.instanceCount = notes.length
  return geometry
}
