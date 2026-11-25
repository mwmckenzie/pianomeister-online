import {
  type BufferGeometry,
  InstancedBufferGeometry,
  InterleavedBufferAttribute,
  type Mesh,
  type ShaderMaterial,
} from 'three'

import { type InstanceRange, NoteSpans, type TickWindow } from '../model/NoteSpans'

/** Geometries kept per layer; more only while one frame needs more (short loops repeated). */
const KEPT = 12

interface Variant {
  readonly geometry: InstancedBufferGeometry
  usedAt: number
}

type LayerMesh = Mesh<BufferGeometry, ShaderMaterial>

/**
 * Draws only a layer's notes in view (milestone 11). The buffers hold the whole song and don't
 * change as it plays: a geometry per instance range shares them, its attributes starting further
 * in. Moving the window swaps geometries, so it uploads nothing, whatever the jump.
 */
export class InstanceWindow {
  private readonly spans: NoteSpans
  private readonly variants = new Map<string, Variant>()
  /** Counts updates, so the variants of the current frame are never released. */
  private now = 0
  /** Instances drawn by the layer itself in the last update. */
  drawn = 0

  constructor(
    private full: InstancedBufferGeometry,
    notes: readonly { readonly startTick: number; readonly endTick: number }[],
    descending: boolean,
    /** What shows the layer itself: the mesh, its glow twin, its mask. */
    private readonly meshes: LayerMesh[],
  ) {
    this.spans = new NoteSpans(notes, descending)
  }

  get followers(): readonly LayerMesh[] {
    return this.meshes
  }

  follow(mesh: LayerMesh): void {
    this.meshes.push(mesh)
  }

  /** The layer's meshes draw this window (null: the whole song) from now on. */
  update(window: TickWindow | null): void {
    this.now++
    const geometry = this.geometryFor(window)
    this.drawn = geometry.instanceCount
    for (const mesh of this.meshes) mesh.geometry = geometry
  }

  /** The geometry that draws a window, for this frame. */
  geometryFor(window: TickWindow | null): InstancedBufferGeometry {
    if (window === null) return this.full
    const range = this.spans.range(window)
    const key = `${range.first}:${range.count}`
    let variant = this.variants.get(key)
    if (variant === undefined) {
      variant = { geometry: this.build(range), usedAt: this.now }
      this.variants.set(key, variant)
      this.trim()
    }
    variant.usedAt = this.now
    return variant.geometry
  }

  /** New buffers (rounded or square heads); the old ones are freed. */
  replace(full: InstancedBufferGeometry): void {
    this.dispose()
    this.full = full
    for (const mesh of this.meshes) mesh.geometry = full
  }

  dispose(): void {
    // All with their attributes: the shared buffers are freed by whichever was drawn.
    for (const { geometry } of this.variants.values()) geometry.dispose()
    this.variants.clear()
    this.full.dispose()
  }

  private build(range: InstanceRange): InstancedBufferGeometry {
    const geometry = new InstancedBufferGeometry()
    geometry.setIndex(this.full.index)
    for (const [name, attribute] of Object.entries(this.full.attributes)) {
      geometry.setAttribute(
        name,
        attribute instanceof InterleavedBufferAttribute
          ? new InterleavedBufferAttribute(
              attribute.data,
              attribute.itemSize,
              range.first * attribute.data.stride + attribute.offset,
            )
          : attribute,
      )
    }
    geometry.instanceCount = range.count
    return geometry
  }

  private trim(): void {
    if (this.variants.size <= KEPT) return
    const old = [...this.variants].filter(([, v]) => v.usedAt < this.now)
    old.sort(([, a], [, b]) => a.usedAt - b.usedAt)
    for (const [key, { geometry }] of old.slice(0, this.variants.size - KEPT)) {
      this.variants.delete(key)
      // Disposing a geometry frees the buffers of its attributes: they are the others' too.
      geometry.setIndex(null)
      for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name)
      geometry.dispose()
    }
  }
}
