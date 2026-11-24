// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { EMPTY_COLOUR_SETS } from '../color/EMPTY_COLOUR_SETS'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import type { Look } from './Look'
import { lookSwatch } from './lookSwatch'

const look = (values: Look['values']): Look => ({
  id: 'x',
  name: 'X',
  builtIn: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  values,
})

describe('lookSwatch', () => {
  it('takes the mono colour, the white-key colour, else the palette C', () => {
    expect(
      lookSwatch(
        look({ 'notes.palette': 'mono', 'notes.paletteMono': '#ffc21a' }),
        EMPTY_COLOUR_SETS,
      ),
    ).toBe('#FFC21A')
    expect(
      lookSwatch(
        look({ 'notes.palette': 'twoTone', 'notes.paletteWhite': '#7ee0c3' }),
        EMPTY_COLOUR_SETS,
      ),
    ).toBe('#7EE0C3')
    expect(lookSwatch(look({ 'notes.palette': 'default' }), EMPTY_COLOUR_SETS)).toMatch(
      /^#[0-9A-F]{6}$/i,
    )
  })

  it('gives every built-in look a colour', () => {
    for (const l of BUILT_IN_LOOKS)
      expect(lookSwatch(l, EMPTY_COLOUR_SETS)).toMatch(/^#[0-9A-F]{6}$/i)
  })
})
