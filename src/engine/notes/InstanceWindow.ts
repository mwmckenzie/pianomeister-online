import {
  type BufferGeometry,
  DynamicDrawUsage,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  type Mesh,
  type ShaderMaterial,
} from 'three'

import { NoteSpans, type RangeBounds, type TickWindow } from '../model/NoteSpans'

type LayerMesh = Mesh<BufferGeometry, ShaderMaterial>

/** A geometry of its own for one window: the layer's (slot 0) or a loop repeat's. */
interface Slot {
  geometry: InstancedBufferGeometry
  data: InstancedInterleavedBuffer
  first: number
  count: number
  /** The song data's version it was filled from. */
  version: number
}

/** Room for this many instances at first; doubled when a window needs more. */
const FIRST_CAPACITY = 64

/**
 * Draws only a layer's notes in view (milestone 11). The song's notes stay in one packed array on
 * the CPU; a stable geometry holds those in the window, and is refilled only when the window's
 * notes change (a bucket of them at a time). One small upload then, and no new vertex setup: a
 * geometry per window would set one up for nearly every frame of dense music.
 */
export class InstanceWindow {
  private readonly spans: NoteSpans
  private readonly slots = new Map<number, Slot>()
  /** The windows that need no change to the layer's own geometry. */
  private same: RangeBounds | null = null
  private mine: InstancedBufferGeometry | null = null
  /** Counts changes to the song data (colours, label reveals). */
  private version = 0
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

  /** The whole song's geometry: its attributes write to the packed array, then `touch()`. */
  get song(): InstancedBufferGeometry {
    return this.full
  }

  /** The song data changed. */
  touch(): void {
    this.version++
    packed(this.full).needsUpdate = true
  }

  /** The layer's meshes draw this window (null: the whole song) from now on. */
  update(window: TickWindow | null): void {
    const same = this.same
    if (
      window !== null &&
      same !== null &&
      window.startFrom === undefined &&
      window.from >= same.from &&
      window.from < same.fromEnd &&
      window.to > same.toStart &&
      window.to <= same.to
    ) {
      // Most frames: the same notes in the same geometry (changed data: refresh).
      this.refresh()
      const { mine } = this
      for (const mesh of this.meshes) {
        if (mine !== null && mesh.geometry !== mine) mesh.geometry = mine
      }
      return
    }
    const geometry = this.geometryFor(window, 0)
    const narrowed = window === null || window.startFrom !== undefined
    this.same = narrowed ? null : this.spans.bounds(window)
    this.mine = geometry
    this.drawn = geometry.instanceCount
    for (const mesh of this.meshes) if (mesh.geometry !== geometry) mesh.geometry = geometry
  }

  /** The geometry that draws a window; each `slot` (a loop repeat's number) has its own. */
  geometryFor(window: TickWindow | null, slot: number): InstancedBufferGeometry {
    if (window === null) return this.full
    const { first, count } = this.spans.range(window)
    let s = this.slots.get(slot)
    if (s === undefined || count > s.data.count) {
      const capacity = Math.max(FIRST_CAPACITY, 2 ** Math.ceil(Math.log2(Math.max(1, count))))
      const old = s
      s = this.build(capacity)
      this.slots.set(slot, s)
      if (old !== undefined) release(old.geometry)
    }
    if (s.first !== first || s.count !== count || s.version !== this.version) {
      s.first = first
      s.count = count
      this.fill(s)
    }
    return s.geometry
  }

  /** Takes changes made after this frame's windows were chosen (label placement). */
  refresh(): void {
    for (const s of this.slots.values()) if (s.version !== this.version) this.fill(s)
  }

  /** New song data (rounded or square heads); the old buffers are freed. */
  replace(full: InstancedBufferGeometry): void {
    this.dispose()
    this.full = full
    this.version++
    for (const mesh of this.meshes) mesh.geometry = full
  }

  dispose(): void {
    this.same = null
    this.mine = null
    // All with their shared per-vertex attributes, which are freed by whichever was drawn.
    for (const { geometry } of this.slots.values()) geometry.dispose()
    this.slots.clear()
    this.full.dispose()
  }

  private fill(s: Slot): void {
    const source = packed(this.full)
    const { stride } = source
    const { first, count, data } = s
    data.array.set(source.array.subarray(first * stride, (first + count) * stride))
    data.clearUpdateRanges()
    data.addUpdateRange(0, count * stride)
    data.needsUpdate = true
    s.geometry.instanceCount = count
    s.version = this.version
  }

  private build(capacity: number): Slot {
    const { stride } = packed(this.full)
    const data = new InstancedInterleavedBuffer(new Float32Array(capacity * stride), stride)
    data.setUsage(DynamicDrawUsage)
    const geometry = new InstancedBufferGeometry()
    geometry.setIndex(this.full.index)
    for (const [name, attribute] of Object.entries(this.full.attributes)) {
      geometry.setAttribute(
        name,
        attribute instanceof InterleavedBufferAttribute
          ? new InterleavedBufferAttribute(data, attribute.itemSize, attribute.offset)
          : attribute,
      )
    }
    geometry.instanceCount = 0
    return { geometry, data, first: -1, count: -1, version: -1 }
  }
}

/** The packed per-instance array behind a note geometry's attributes (packInstances). */
function packed(geometry: InstancedBufferGeometry): InstancedInterleavedBuffer {
  for (const attribute of Object.values(geometry.attributes)) {
    if (attribute instanceof InterleavedBufferAttribute) {
      return attribute.data as InstancedInterleavedBuffer
    }
  }
  throw new Error('no per-instance attributes')
}

/** Disposing a geometry frees its attributes' buffers: not the per-vertex ones, others use them. */
function release(geometry: InstancedBufferGeometry): void {
  geometry.setIndex(null)
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (!(attribute instanceof InterleavedBufferAttribute)) geometry.deleteAttribute(name)
  }
  geometry.dispose()
}
