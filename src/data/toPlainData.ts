/**
 * A deep copy made only of plain objects, arrays, primitives and binary data. Reading through
 * the value's properties also unwraps proxies (e.g. Vue reactive state), which IndexedDB's
 * structured clone would reject with a DataCloneError.
 */
export function toPlainData<T>(value: T): T {
  return copy(value) as T
}

function copy(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof ArrayBuffer) return value.slice(0)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
  }
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) return value.map(copy)
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    // Functions can't be stored anyway; leave them out rather than fail the write.
    if (typeof item !== 'function') out[key] = copy(item)
  }
  return out
}
