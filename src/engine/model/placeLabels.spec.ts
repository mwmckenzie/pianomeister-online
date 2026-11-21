// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { LabelState } from './LabelState'
import { placeLabels } from './placeLabels'

const at = (x: number, state: LabelState = 'new', y = 0) => ({
  rect: { x, y, width: 20, height: 10 },
  state,
})

describe('placeLabels', () => {
  it('shows new labels that do not overlap', () => {
    expect(placeLabels([at(0), at(30), at(0, 'new', 20)])).toEqual(['shown', 'shown', 'shown'])
  })

  it('hides the farther of two new overlapping labels', () => {
    expect(placeLabels([at(0), at(10)])).toEqual(['shown', 'hidden'])
  })

  it('compares only with shown labels, so a hidden one hides nothing', () => {
    expect(placeLabels([at(0), at(15), at(30)])).toEqual(['shown', 'hidden', 'shown'])
  })

  it('never hides a shown label, even behind a nearer one it overlaps', () => {
    expect(placeLabels([at(0), at(5, 'shown')])).toEqual(['hidden', 'shown'])
    expect(placeLabels([at(0, 'shown'), at(5, 'shown')])).toEqual(['shown', 'shown'])
  })

  it('reveals a hidden label only once it clears its neighbour by 4 px', () => {
    // 20 px wide: touching at 20, PLACE_GAP clear at 22, REVEAL_GAP clear at 24.
    expect(placeLabels([at(0, 'shown'), at(23)])).toEqual(['shown', 'shown'])
    expect(placeLabels([at(0, 'shown'), at(23, 'hidden')])).toEqual(['shown', 'hidden'])
    expect(placeLabels([at(0, 'shown'), at(24, 'hidden')])).toEqual(['shown', 'shown'])
  })

  it('is stable on a boundary: a label hovering at the reveal edge never flips back', () => {
    let state: LabelState = 'hidden'
    const history: LabelState[] = []
    for (const x of [23.9, 24, 23.9, 24.1, 23.5, 22]) {
      state = placeLabels([at(0, 'shown'), at(x, state)])[1] ?? state
      history.push(state)
    }
    expect(history).toEqual(['hidden', 'shown', 'shown', 'shown', 'shown', 'shown'])
  })
})
