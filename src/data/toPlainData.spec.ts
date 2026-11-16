// @vitest-environment node
import { reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { toPlainData } from './toPlainData'

describe('toPlainData', () => {
  it('turns reactive objects and arrays into structured-cloneable plain data', () => {
    const state = reactive({ hands: { right: [0, 2], left: [1] }, tags: ['a'], n: 3, s: 'x' })
    const plain = toPlainData(state)
    expect(plain).toEqual({ hands: { right: [0, 2], left: [1] }, tags: ['a'], n: 3, s: 'x' })
    expect(() => structuredClone(state)).toThrow(/could not be cloned/)
    expect(() => structuredClone(plain)).not.toThrow()
  })

  it('unwraps nested proxies taken out of a deep ref', () => {
    const hands = ref({ right: [0], left: [1] })
    const swapped = toPlainData({ right: hands.value.left, left: hands.value.right })
    expect(structuredClone(swapped)).toEqual({ right: [1], left: [0] })
  })

  it('copies binary data and keeps primitives, null and undefined', () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer
    const plain = toPlainData({
      buffer,
      view: new Uint8Array([4, 5]),
      none: null,
      missing: undefined,
    })
    expect(new Uint8Array(plain.buffer)).toEqual(new Uint8Array([1, 2, 3]))
    expect(plain.buffer).not.toBe(buffer)
    expect(plain.view).toEqual(new Uint8Array([4, 5]))
    expect(plain.none).toBeNull()
    expect('missing' in plain).toBe(true)
  })
})
