// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { placeNextSong } from './placeNextSong'

const song = { startSec: 0, durationSec: 60 }

describe('placeNextSong', () => {
  it('keeps the usual place, crossfade seconds before the end', () => {
    expect(placeNextSong(song, 90, 2, 57, 0.1)).toEqual({ startSec: 58, late: false })
  })

  it('starts just ahead when the usual place has passed, still overlapping', () => {
    const placed = placeNextSong(song, 90, 2, 59, 0.1)
    expect(placed.late).toBe(true)
    expect(placed.startSec).toBeCloseTo(59.1, 9)
  })

  it('is never late with the short gap of crossfade 0', () => {
    expect(placeNextSong(song, 90, 0, 59.5, 0.1)).toEqual({ startSec: 61, late: false })
  })
})
