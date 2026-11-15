// @vitest-environment node
import { LAYERS } from 'smplr'
import { describe, expect, it } from 'vitest'

import { sampleFileName } from './sampleFileName'

describe('sampleFileName', () => {
  it('makes names URL-safe', () => {
    expect(sampleFileName('Mf C#5')).toBe('Mf_Cs5')
    expect(sampleFileName('PP B-1')).toBe('PP_B-1')
  })

  it('maps every piano sample to a distinct, URL-safe file name', () => {
    const names = [...new Set(LAYERS.flatMap((layer) => layer.samples.map(([, name]) => String(name))))]
    const files = names.map(sampleFileName)
    expect(new Set(files).size).toBe(names.length)
    for (const file of files) expect(encodeURIComponent(file)).toBe(file)
  })
})
