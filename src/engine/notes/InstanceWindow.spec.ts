// @vitest-environment node
import {
  InstancedBufferGeometry,
  type InterleavedBufferAttribute,
  Mesh,
  ShaderMaterial,
} from 'three'
import { describe, expect, it } from 'vitest'

import { InstanceWindow } from './InstanceWindow'
import { packInstances } from './packInstances'

const notes = Array.from({ length: 400 }, (_, i) => ({ startTick: i * 10, endTick: i * 10 + 10 }))

function layer() {
  const full = new InstancedBufferGeometry()
  packInstances(full, notes.length, {
    aTicks: [notes.flatMap((n) => [n.startTick, n.endTick]), 2],
    aColor: [notes.map((_, i) => i / 1000), 1],
  })
  full.instanceCount = notes.length
  const mesh = new Mesh(full, new ShaderMaterial())
  const twin = new Mesh(full, new ShaderMaterial())
  return { window: new InstanceWindow(full, notes, false, [mesh, twin]), mesh, twin, full }
}

const attribute = (mesh: Mesh, name: string) =>
  mesh.geometry.getAttribute(name) as InterleavedBufferAttribute
const starts = (mesh: Mesh) =>
  Array.from({ length: (mesh.geometry as InstancedBufferGeometry).instanceCount }, (_, i) =>
    attribute(mesh, 'aTicks').getX(i),
  )

describe('InstanceWindow', () => {
  it('draws the window’s notes, in order, on every mesh, from one stable geometry', () => {
    const { window, mesh, twin } = layer()
    window.update({ from: 1000, to: 1500 })
    const geometry = mesh.geometry
    expect(twin.geometry).toBe(geometry)
    expect(starts(mesh)[0]).toBeLessThanOrEqual(1000 - 80)
    expect(Math.max(...starts(mesh))).toBeGreaterThanOrEqual(1490 + 80)
    expect(starts(mesh)).toEqual([...starts(mesh)].sort((a, b) => a - b))
    // Moving on refills it, and changes no attribute.
    window.update({ from: 2000, to: 2500 })
    expect(mesh.geometry).toBe(geometry)
    expect(starts(mesh)).toContain(2000)
    expect(starts(mesh)).not.toContain(1000)
  })

  it('uploads only when the notes in the window change', () => {
    const { window, mesh } = layer()
    window.update({ from: 1000, to: 1500 })
    const { data } = attribute(mesh, 'aTicks')
    const version = data.version
    window.update({ from: 1001, to: 1501 })
    expect(data.version).toBe(version)
    window.update({ from: 1200, to: 1700 })
    expect(data.version).toBe(version + 1)
  })

  it('follows a change to the song data', () => {
    const { window, mesh, full } = layer()
    window.update({ from: 1000, to: 1500 })
    const at = starts(mesh).indexOf(1200)
    ;(full.getAttribute('aColor') as InterleavedBufferAttribute).setX(120, 0.75)
    window.touch()
    window.refresh()
    expect(attribute(mesh, 'aColor').getX(at)).toBe(0.75)
  })

  it('grows for a wider window, and a repeat’s slot leaves the layer’s alone', () => {
    const { window, mesh } = layer()
    window.update({ from: 1000, to: 1100 })
    const before = starts(mesh)
    const copy = window.geometryFor({ from: 0, to: 4000 }, 3)
    expect(copy).not.toBe(mesh.geometry)
    expect(copy.instanceCount).toBe(400)
    expect(starts(mesh)).toEqual(before)
    window.update({ from: 0, to: 4000 })
    expect(starts(mesh)).toHaveLength(400)
    // Shrinking again keeps the room.
    const wide = mesh.geometry
    window.update({ from: 1000, to: 1100 })
    expect(mesh.geometry).toBe(wide)
    expect(starts(mesh)).toEqual(before)
  })

  it('draws nothing with nothing in view, and the whole song without a window', () => {
    const { window, mesh, full } = layer()
    window.update({ from: 9000, to: 9500 })
    expect(starts(mesh)).toEqual([])
    window.update(null)
    expect(mesh.geometry).toBe(full)
  })
})
