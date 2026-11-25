import { type BufferGeometry, Mesh, type Object3D, type ShaderMaterial } from 'three'

import type { LoopWindow } from '@/core/transport/LoopWindow'

import type { TickWindow } from './model/NoteSpans'
import type { InstanceWindow } from './notes/InstanceWindow'
import type { TimeUniforms } from './TimeUniforms'

/** A layer drawn again for each repeat, and where its copies live (the scene or the glow scene). */
export interface RepeatSource {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>
  readonly parent: () => Object3D
  /** The layer's notes: copies draw only those of their own iteration in view. */
  readonly window?: InstanceWindow
}

/** The notes copy `k` shows, at the playhead moved back by k periods. Null: all. */
export type CopyWindow = (layer: InstanceWindow, k: number) => TickWindow | null

/**
 * "After the loop end: Next repeat" (milestone 9.2). Each repeated layer gets copies that share
 * its geometry, material and uniforms (nothing is duplicated on the CPU, per frame or ever):
 * copy k draws with the playhead moved back by k periods and clipped to one iteration, so the
 * iteration appears k periods past the loop end, exactly where the playhead will be after the
 * wraps. The shared uniforms are set just before each copy draws and put back right after.
 */
export class LoopRepeat {
  private readonly copies = new Map<RepeatSource, Mesh<BufferGeometry, ShaderMaterial>[]>()
  private sources: readonly RepeatSource[] = []
  private window: LoopWindow | null = null
  private count = 0
  /** The values the copies put back after drawing: this frame's real playhead and clip. */
  private real = { tick: 0, clipLo: -1e9, clipHi: 1e9 }

  constructor(private readonly time: TimeUniforms) {}

  /** The layers to repeat (on a new song); copies of earlier sources are removed. */
  setSources(sources: readonly RepeatSource[]): void {
    for (const [source, meshes] of this.copies) {
      for (const mesh of meshes) mesh.removeFromParent()
      this.copies.delete(source)
    }
    this.sources = sources
    this.count = 0
  }

  /** How many copies of each layer draw this frame, for which loop window. */
  update(window: LoopWindow | null, count: number, notesOf: CopyWindow = () => null): void {
    this.window = window
    this.count = window === null ? 0 : count
    const { time } = this
    this.real = {
      tick: time.uTick.value,
      clipLo: time.uClipLo.value,
      clipHi: time.uClipHi.value,
    }
    for (const source of this.sources) {
      const meshes = this.copiesOf(source, this.count)
      meshes.forEach((mesh, i) => {
        mesh.visible = i < this.count && source.mesh.visible && visibleUp(source.mesh)
        mesh.geometry =
          source.window !== undefined && mesh.visible
            ? source.window.geometryFor(notesOf(source.window, i + 1), i + 1)
            : source.mesh.geometry
        mesh.renderOrder = source.mesh.renderOrder
      })
    }
  }

  /** The copies of glow-scene sources, for the glow scene to add back after a rebuild. */
  attachTo(parent: Object3D): void {
    for (const source of this.sources) {
      if (source.parent() !== parent) continue
      for (const mesh of this.copies.get(source) ?? []) parent.add(mesh)
    }
  }

  /** Draw calls added this frame (for the perf report). */
  get drawnCopies(): number {
    let n = 0
    for (const meshes of this.copies.values()) n += meshes.filter((m) => m.visible).length
    return n
  }

  dispose(): void {
    this.setSources([])
  }

  private copiesOf(source: RepeatSource, needed: number): Mesh<BufferGeometry, ShaderMaterial>[] {
    let meshes = this.copies.get(source)
    if (meshes === undefined) {
      meshes = []
      this.copies.set(source, meshes)
    }
    while (meshes.length < needed) meshes.push(this.copy(source, meshes.length + 1))
    return meshes
  }

  private copy(source: RepeatSource, k: number): Mesh<BufferGeometry, ShaderMaterial> {
    const mesh = new Mesh(source.mesh.geometry, source.mesh.material)
    mesh.frustumCulled = false
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(source.mesh.matrix)
    mesh.matrixWorld.copy(source.mesh.matrixWorld)
    mesh.renderOrder = source.mesh.renderOrder
    mesh.visible = false
    const { time } = this
    mesh.onBeforeRender = (_r, _s, _c, _g, material) => {
      const window = this.window
      if (window === null) return
      time.uTick.value = this.real.tick - k * window.periodTicks
      time.uClipLo.value = window.preStartTick
      time.uClipHi.value = window.endTick
      ;(material as ShaderMaterial).uniformsNeedUpdate = true
    }
    mesh.onAfterRender = (_r, _s, _c, _g, material) => {
      time.uTick.value = this.real.tick
      time.uClipLo.value = this.real.clipLo
      time.uClipHi.value = this.real.clipHi
      // The next draw may use the same material without re-uploading its uniforms.
      ;(material as ShaderMaterial).uniformsNeedUpdate = true
    }
    source.parent().add(mesh)
    return mesh
  }
}

/** Visible itself and through every ancestor. */
function visibleUp(object: Object3D): boolean {
  for (let o: Object3D | null = object; o !== null; o = o.parent) if (!o.visible) return false
  return true
}
