// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MAX_UPLOAD_BYTES, validateUpload } from './validateUpload'

describe('validateUpload', () => {
  it('accepts .mid and .midi in any case', () => {
    expect(validateUpload({ name: 'a.mid', size: 100 })).toBeNull()
    expect(validateUpload({ name: 'B.MIDI', size: MAX_UPLOAD_BYTES })).toBeNull()
  })

  it('rejects other extensions', () => {
    expect(validateUpload({ name: 'notes.txt', size: 10 })).toMatch(/not a MIDI file/)
    expect(validateUpload({ name: 'song.mid.zip', size: 10 })).toMatch(/not a MIDI file/)
  })

  it('rejects files over 2 MB and empty files', () => {
    expect(validateUpload({ name: 'big.mid', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/2 MB/)
    expect(validateUpload({ name: 'empty.mid', size: 0 })).toMatch(/empty/)
  })
})
