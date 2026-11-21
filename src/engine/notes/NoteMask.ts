import {
  AlwaysStencilFunc,
  type BufferGeometry,
  Mesh,
  ReplaceStencilOp,
  ShaderMaterial,
} from 'three'

/** Stencil value where a note is drawn. */
export const NOTE_STENCIL = 1

/**
 * A note layer drawn into the stencil buffer only (no colour, no depth), before the cages:
 * cages skip those pixels, so a translucent note shows the highway through it, never a cage
 * fill (brief decision 115). Shares the layer's geometry, shaders and uniforms, so it covers
 * exactly what the layer draws; sync() follows geometry and visibility on settings changes.
 */
export class NoteMask<G extends BufferGeometry = BufferGeometry> {
  readonly mesh: Mesh<G, ShaderMaterial>

  constructor(
    private readonly source: Mesh<G, ShaderMaterial>,
    renderOrder: number,
  ) {
    const main = source.material
    this.mesh = new Mesh(
      source.geometry,
      new ShaderMaterial({
        vertexShader: main.vertexShader,
        fragmentShader: main.fragmentShader,
        uniforms: main.uniforms,
        defines: main.defines,
        colorWrite: false,
        depthWrite: false,
        depthTest: false,
        stencilWrite: true,
        stencilRef: NOTE_STENCIL,
        stencilFunc: AlwaysStencilFunc,
        stencilZPass: ReplaceStencilOp,
        side: main.side,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
  }

  /** `needed`: a cage is drawn that the notes must not take a tint from. */
  sync(needed: boolean): void {
    const { source, mesh } = this
    if (mesh.geometry !== source.geometry) mesh.geometry = source.geometry
    mesh.visible = needed && source.visible
  }

  dispose(): void {
    // The geometry belongs to the source mesh.
    this.mesh.material.dispose()
  }
}
