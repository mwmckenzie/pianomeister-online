import { InstancedInterleavedBuffer, InterleavedBufferAttribute } from 'three'

/**
 * A per-instance attribute that can start later in its buffer (InstanceWindow): WebGL2 has no
 * base instance, but an interleaved attribute has an offset.
 */
export function instanced(data: Float32Array, itemSize: number): InterleavedBufferAttribute {
  return new InterleavedBufferAttribute(new InstancedInterleavedBuffer(data, itemSize), itemSize, 0)
}
