import { BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry } from 'three'

import type { NoteInstance } from '../model/NoteInstance'
import { NoteColors } from '../NoteColors'

/** For geometry whose colour nothing reads (the contact shadow). */
const DEFAULT_COLORS = new NoteColors()

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
  colors: NoteColors = DEFAULT_COLORS,
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
  const velocity = new Float32Array(notes.length)
  notes.forEach((n, i) => {
    lane.set([n.x, n.width], i * 2)
    ticks.set([n.startTick, n.endTick, n.headEndTick], i * 3)
    velocity[i] = n.velocity
  })
  geometry.setAttribute('aLane', new InstancedBufferAttribute(lane, 2))
  geometry.setAttribute('aTicks', new InstancedBufferAttribute(ticks, 3))
  geometry.setAttribute('aColor', new InstancedBufferAttribute(colorData(notes, colors), 3))
  geometry.setAttribute('aVelocity', new InstancedBufferAttribute(velocity, 1))
  geometry.instanceCount = notes.length
  return geometry
}

/** Each note's colour (r, g, b) from the palette. */
function colorData(notes: readonly NoteInstance[], colors: NoteColors): Float32Array {
  const data = new Float32Array(notes.length * 3)
  notes.forEach((n, i) => {
    const c = colors.at(n.colorIndex)
    data.set([c.r, c.g, c.b], i * 3)
  })
  return data
}

/** Rewrites the notes' colours in place after a palette change (same order as built). */
export function recolorNotes(
  geometry: InstancedBufferGeometry,
  notes: readonly NoteInstance[],
  colors: NoteColors,
): void {
  const attribute = geometry.getAttribute('aColor') as InstancedBufferAttribute
  ;(attribute.array as Float32Array).set(colorData(notes, colors))
  attribute.needsUpdate = true
}
