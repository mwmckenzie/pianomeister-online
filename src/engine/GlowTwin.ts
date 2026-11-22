import {
  AdditiveBlending,
  type BufferGeometry,
  InstancedMesh,
  Mesh,
  NoBlending,
  type Object3D,
  ShaderMaterial,
} from 'three'

/**
 * A mesh's copy in the glow scene (brief decision 109): the same geometry and the same uniform
 * objects (so one update moves both), compiled with GLOW_PASS defined so the shader outputs
 * only what should bloom. Emitters add up; occluders (keys, 3D heads) are opaque and write
 * depth, so they hide glow behind them and add their own emission where they have one.
 *
 * The twin lives in its own small scene, not beside its source, so the bloom pass walks only
 * the twins. It doesn't follow its source by itself: the owner of the glow scene calls sync()
 * whenever settings or the song change (geometry, visibility, placement), never per frame.
 * Per-frame changes reach the twin through what it shares: uniforms, instance matrices and
 * attribute buffers.
 */
export class GlowTwin<G extends BufferGeometry = BufferGeometry> {
  readonly mesh: Mesh<G, ShaderMaterial>
  /** Set by the owner: false keeps the twin hidden even while bloom runs. */
  enabled = true

  constructor(
    private readonly source: Mesh<G, ShaderMaterial>,
    kind: 'emitter' | 'occluder',
  ) {
    const main = source.material
    const material = new ShaderMaterial({
      vertexShader: main.vertexShader,
      fragmentShader: main.fragmentShader,
      uniforms: main.uniforms,
      defines: { ...main.defines, GLOW_PASS: '' },
      transparent: kind === 'emitter',
      blending: kind === 'emitter' ? AdditiveBlending : NoBlending,
      depthWrite: kind === 'occluder',
      depthTest: true,
      side: main.side,
    })
    if (source instanceof InstancedMesh) {
      // Instanced meshes (the keys): the twin shares the instance matrices, so presses follow.
      const twin = new InstancedMesh(source.geometry, material, source.count)
      twin.instanceMatrix = source.instanceMatrix
      this.mesh = twin
    } else {
      this.mesh = new Mesh(source.geometry, material)
    }
    // Placed from the source's world matrix in sync(); the glow scene's root is the identity.
    this.mesh.matrixAutoUpdate = false
    this.mesh.frustumCulled = false
    this.sync(false)
  }

  /** Follows the source's geometry, visibility (its ancestors' too), placement and order. */
  sync(bloomActive: boolean): void {
    const { source, mesh } = this
    if (mesh.geometry !== source.geometry) mesh.geometry = source.geometry
    mesh.visible = bloomActive && this.enabled && shownInScene(source)
    mesh.renderOrder = source.renderOrder
    source.updateWorldMatrix(true, false)
    mesh.matrix.copy(source.matrixWorld)
    mesh.matrixWorldNeedsUpdate = true
    // Black-lane notes drawn on top of the white ones (see HeadLayer.setLift) stay on top here.
    mesh.material.depthTest = source.material.depthTest
    mesh.material.depthFunc = source.material.depthFunc
  }

  dispose(): void {
    // The geometry belongs to the source mesh.
    this.mesh.material.dispose()
  }
}

/** Visible itself and through every ancestor (a hidden group hides its children). */
function shownInScene(object: Object3D): boolean {
  for (let o: Object3D | null = object; o !== null; o = o.parent) if (!o.visible) return false
  return true
}
