// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { closeNeighbours, closeNeighboursText } from './closeNeighbours'
import {
  addSet,
  isSetModified,
  removeSet,
  renameSet,
  resetColour,
  resetSet,
  setColour,
} from './colourSetEdits'
import type { ColourSet } from './ColourSet'
import { EMPTY_COLOUR_SETS } from './EMPTY_COLOUR_SETS'
import { copySetName, freeSetName, isSetNameTaken } from './freeSetName'
import { applyColourSetMerge, mergeColourSets } from './mergeColourSets'
import { okLabDistance } from './okLabDistance'
import { parseHex } from './parseHex'
import { readColourSets, readSavedColours } from './readColourSets'
import { savedColoursOf } from './savedColoursOf'

const twelve = (hex: string) => Array.from({ length: 12 }, () => hex)
const set = (id: string, name: string, hex = '#101010'): ColourSet => ({
  id: `custom-${id}`,
  name,
  colours: twelve(hex),
})

describe('parseHex', () => {
  it('takes six digits with or without #, in any case', () => {
    expect(parseHex('#a1B2c3')).toBe('#A1B2C3')
    expect(parseHex(' a1b2c3 ')).toBe('#A1B2C3')
    for (const bad of ['', '#abc', '#12345g', 'red', '##112233', '#1122334']) {
      expect(parseHex(bad)).toBeNull()
    }
  })
})

describe('colour edits', () => {
  it('stores a built-in change as an override and drops it at the original colour', () => {
    const changed = setColour(EMPTY_COLOUR_SETS, 'warm', 0, '#abcdef', '#FF2D2D')
    expect(changed.overrides).toEqual({ warm: { 0: '#ABCDEF' } })
    expect(isSetModified(changed, 'warm')).toBe(true)
    expect(setColour(changed, 'warm', 0, '#ff2d2d', '#FF2D2D')).toEqual(EMPTY_COLOUR_SETS)
  })

  it('resets one colour or the whole set', () => {
    let sets = setColour(EMPTY_COLOUR_SETS, 'warm', 0, '#000001', '#FF2D2D')
    sets = setColour(sets, 'warm', 3, '#000002', '#FF2D2D')
    expect(resetColour(sets, 'warm', 0).overrides).toEqual({ warm: { 3: '#000002' } })
    expect(resetSet(sets, 'warm')).toEqual(EMPTY_COLOUR_SETS)
  })

  it('changes, renames and removes a custom set', () => {
    let sets = addSet(EMPTY_COLOUR_SETS, set('a', 'A'))
    sets = setColour(sets, 'custom-a', 2, '#ffffff', '#101010')
    expect(sets.custom[0]?.colours[2]).toBe('#FFFFFF')
    expect(isSetModified(sets, 'custom-a')).toBe(false)
    expect(renameSet(sets, 'custom-a', 'B').custom[0]?.name).toBe('B')
    expect(removeSet(sets, 'custom-a').custom).toEqual([])
  })
})

describe('set names', () => {
  it('numbers a copy whose name is taken', () => {
    let sets = addSet(EMPTY_COLOUR_SETS, set('a', copySetName(EMPTY_COLOUR_SETS, 'Warm')))
    expect(sets.custom[0]?.name).toBe('Warm copy')
    expect(copySetName(sets, 'Warm')).toBe('Warm copy 2')
    sets = addSet(sets, set('b', 'warm COPY 2'))
    expect(copySetName(sets, 'Warm')).toBe('Warm copy 3')
  })

  it('keeps built-in names taken and stays within the limit', () => {
    expect(isSetNameTaken(EMPTY_COLOUR_SETS, 'neon')).toBe(true)
    const long = 'x'.repeat(60)
    const sets = addSet(EMPTY_COLOUR_SETS, set('a', long))
    expect(isSetNameTaken(sets, long, 'custom-a')).toBe(false)
    expect(freeSetName(sets, long)).toBe(`${'x'.repeat(58)} 2`)
    expect(copySetName(sets, long).length).toBeLessThanOrEqual(60)
  })
})

describe('close neighbours', () => {
  it('measures OKLab distance × 100', () => {
    expect(okLabDistance('#000000', '#FFFFFF')).toBeCloseTo(100, 1)
    expect(okLabDistance('#123456', '#123456')).toBe(0)
  })

  it('ignores identical colours and wraps from B to C', () => {
    expect(closeNeighbours(twelve('#8AB4FF'))).toEqual([])
    const middle = Array.from({ length: 10 }, (_, i) => (i % 2 ? '#FFFFFF' : '#000000'))
    const colours = ['#FF0000', ...middle, '#FA0000']
    expect(closeNeighbours(colours)).toEqual([[11, 0]])
    expect(closeNeighboursText(colours)).toContain('Hard to tell apart: B and C. ')
  })

  it('lists three pairs and counts the rest', () => {
    const colours = Array.from({ length: 12 }, (_, i) => `#0000${(0x80 + i).toString(16)}`)
    expect(closeNeighboursText(colours)).toContain('C and C♯, C♯ and D, D and D♯ and 9 more.')
  })
})

describe('readColourSets', () => {
  it('drops what is malformed', () => {
    expect(readColourSets(null)).toEqual(EMPTY_COLOUR_SETS)
    const read = readColourSets({
      overrides: {
        warm: { 0: '#abcdef', 12: '#000000', 1: 'red' },
        cool: { 5: 'x' },
        nope: { 0: '#000000' },
      },
      custom: [
        set('a', ' A '),
        set('a', 'again'),
        { ...set('b', 'B'), colours: ['#000000'] },
        { ...set('c', 'C'), id: 'warm' },
        set('d', ''),
        7,
      ],
    })
    expect(read).toEqual({ overrides: { warm: { 0: '#ABCDEF' } }, custom: [set('a', 'A')] })
    expect(readSavedColours({ name: 'A', colours: [...twelve('#000000').slice(1), 3] })).toBeNull()
  })
})

describe('savedColoursOf', () => {
  it('is the set now, the kept copy while missing, and none for a built-in', () => {
    const kept = { name: 'Old', colours: twelve('#222222') }
    const sets = addSet(EMPTY_COLOUR_SETS, set('a', 'A'))
    expect(savedColoursOf(sets, 'custom-a', kept)).toEqual({
      name: 'A',
      colours: twelve('#101010'),
    })
    expect(savedColoursOf(sets, 'custom-b', kept)).toBe(kept)
    expect(savedColoursOf(sets, 'warm', kept)).toBeNull()
  })
})

describe('mergeColourSets', () => {
  const ids = () => {
    let n = 0
    return () => `new${++n}`
  }

  it('skips what is here and never overwrites', () => {
    const local = {
      overrides: { warm: { 0: '#000001' } },
      custom: [set('a', 'A'), set('b', 'B')],
    }
    const incoming = {
      overrides: { warm: { 0: '#000002' }, cool: { 1: '#000003' } },
      custom: [set('a', 'Renamed there'), set('b', 'B', '#202020'), set('c', 'A', '#303030')],
    }
    const merge = mergeColourSets(local, incoming, ids())
    expect(merge.added).toEqual([
      { ...set('b', 'B 2', '#202020'), id: 'custom-new1' },
      set('c', 'A 2', '#303030'),
    ])
    expect([...merge.idMap]).toEqual([['custom-b', 'custom-new1']])
    const after = applyColourSetMerge(local, merge)
    expect(after.overrides).toEqual({ warm: { 0: '#000001' }, cool: { 1: '#000003' } })
    // The same backup again adds nothing, and its looks still find their sets.
    const again = mergeColourSets(after, incoming, ids())
    expect(again.added).toEqual([])
    expect(again.idMap.get('custom-b')).toBe('custom-new1')
  })
})
