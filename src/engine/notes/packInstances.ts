import {
  type InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
} from 'three'

/**
 * Per-instance attributes packed into one interleaved array, so a window of instances is one
 * block to copy (InstanceWindow). Each is its values and how many per instance.
 */
export function packInstances(
  geometry: InstancedBufferGeometry,
  count: number,
  attributes: Readonly<Record<string, readonly [values: ArrayLike<number>, size: number]>>,
): void {
  const stride = Object.values(attributes).reduce((sum, [, size]) => sum + size, 0)
  const data = new Float32Array(count * stride)
  const buffer = new InstancedInterleavedBuffer(data, stride)
  let offset = 0
  for (const [name, [values, size]] of Object.entries(attributes)) {
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < size; k++) data[i * stride + offset + k] = values[i * size + k] ?? 0
    }
    geometry.setAttribute(name, new InterleavedBufferAttribute(buffer, size, offset))
    offset += size
  }
}
