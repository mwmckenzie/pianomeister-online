/**
 * A beveled box described independently of its size. Each vertex is
 * `corner · (halfSize − r) + offset · r`: `corner` is ±1 per axis (which inner corner the vertex
 * hangs off) and `offset` the bevel direction, so the bevel radius r stays a true world size
 * however the box is stretched. Non-indexed triangles; `normal` is per vertex.
 */
export interface BevelTemplate {
  readonly corner: Float32Array
  readonly offset: Float32Array
  readonly normal: Float32Array
  readonly vertexCount: number
}
