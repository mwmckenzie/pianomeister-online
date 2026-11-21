import {
  AdditiveBlending,
  type BufferGeometry,
  InstancedMesh,
  Mesh,
  NoBlending,
  ShaderMaterial,
} from 'three'

import { GLOW_LAYER } from './GLOW_LAYER'

/**
 * A mesh's copy on the glow layer (brief decision 109): the same geometry and the same uniform
 * objects (so one update moves both), compiled with GLOW_PASS defined so the shader outputs
 * only what should bloom. Emitters add up; occluders (keys, 3D heads) are opaque and write
 * depth, so they hide glow behind them and add their own emission where they have one.
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
    this.mesh.layers.set(GLOW_LAYER)
    this.mesh.frustumCulled = false
    this.sync()
  }

  /** Follows the source's geometry (it may be replaced), visibility, order and instancing. */
  sync(bloomActive = true): void {
    const { source, mesh } = this
    if (mesh.geometry !== source.geometry) mesh.geometry = source.geometry
    mesh.visible = bloomActive && this.enabled && source.visible
    mesh.renderOrder = source.renderOrder
    mesh.position.copy(source.position)
    // Black-lane notes drawn on top of the white ones (see HeadLayer.setLift) stay on top here.
    mesh.material.depthTest = source.material.depthTest
    mesh.material.depthFunc = source.material.depthFunc
  }

  dispose(): void {
    // The geometry belongs to the source mesh.
    this.mesh.material.dispose()
  }
}
