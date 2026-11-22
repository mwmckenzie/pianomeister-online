// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { labelStackSlots } from './labelStackSlots'

const note = (startTick: number, centre: number) => ({ startTick, centre })

describe('labelStackSlots', () => {
  it('leaves single notes and spread chords on the note', () => {
    // C–E–G: two white keys apart, no neighbours.
    expect([...labelStackSlots([note(0, 0.5), note(0, 2.5), note(0, 4.5)])]).toEqual([0, 0, 0])
  })

  it('lifts the higher of two neighbouring lanes that start together', () => {
    expect([...labelStackSlots([note(0, 1.5), note(0, 0.5)])]).toEqual([1, 0])
  })

  it('alternates along a run of neighbours', () => {
    // C D E F: each a white key apart.
    expect([...labelStackSlots([0.5, 1.5, 2.5, 3.5].map((c) => note(0, c)))]).toEqual([
      0, 1, 0, 1,
    ])
  })

  it('stacks three high in a chromatic cluster', () => {
    // C, C♯ (~0.6 to the right of C), D.
    expect([...labelStackSlots([note(0, 0.5), note(0, 1.1), note(0, 1.5)])]).toEqual([0, 1, 2])
  })

  it('only stacks notes that start at the same tick', () => {
    expect([...labelStackSlots([note(0, 0.5), note(1, 1.5), note(1, 0.5)])]).toEqual([0, 1, 0])
  })

  it('is decided by the music alone (same input, same slots)', () => {
    const chord = [note(480, 3.5), note(0, 0.5), note(480, 2.5), note(0, 1.5)]
    expect([...labelStackSlots(chord)]).toEqual([...labelStackSlots([...chord])])
    expect([...labelStackSlots(chord)]).toEqual([1, 0, 0, 1])
  })
})
