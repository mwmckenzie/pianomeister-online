// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { basePaletteColors, notePaletteColors } from '../color/notePaletteColors'
import { EMPTY_COLOUR_SETS } from '../color/EMPTY_COLOUR_SETS'
import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { loadColourSets, loadSettings, storedSettings } from '../settings/loadSettings'
import type { NotePalette } from '../settings/NotePalette'
import { changedCount, restoreValues } from '../settings/settingGroups'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import type { Look } from './Look'
import { captureLook, isLookModified, lookSettings } from './lookValues'
import { mergeLooks } from './mergeLooks'
import { readLookFile } from './readLookFile'
import { toLookFile } from './toLookFile'
import { withSavedColours } from './withSavedColours'

const twelve = (hex: string) => Array.from({ length: 12 }, () => hex)
const ID = 'custom-a' as const
const setsWith = (hex: string, name = 'Recital') => ({
  overrides: {},
  custom: [{ id: ID, name, colours: twelve(hex) }],
})
const MINE = restoreValues(DEFAULT_SETTINGS, new Map([['notes.palette', ID]]))
const look = withSavedColours(captureLook(MINE, 'look-1', 'Mine'), setsWith('#111111'))
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value))
const colours = (l: Look, sets = EMPTY_COLOUR_SETS) =>
  notePaletteColors(lookSettings(DEFAULT_SETTINGS, l).notes, sets)

function read(raw: unknown, idMap?: ReadonlyMap<string, typeof ID | 'custom-b'>): Look {
  const result = readLookFile(raw, [], () => 'new', undefined, false, {
    sets: EMPTY_COLOUR_SETS,
    idMap,
  })
  if (!result.ok) throw new Error(result.error)
  return result.looks[0] as Look
}

describe('looks and colour sets', () => {
  it('follows the set while it is here and its own copy once it is missing', () => {
    expect(colours(look, setsWith('#222222'))).toEqual(twelve('#222222'))
    expect(colours(look)).toEqual(twelve('#111111'))
  })

  it('carries the copy through a look file, as the set is at export', () => {
    const back = read(json(toLookFile([look], setsWith('#333333', 'Renamed'))))
    expect(back.values['notes.palette']).toBe(ID)
    expect(back.values['notes.paletteSaved']).toEqual({
      name: 'Renamed',
      colours: twelve('#333333'),
    })
    expect(colours(back)).toEqual(twelve('#333333'))
  })

  it('drops a broken copy and follows a set that got another id', () => {
    const file = json(toLookFile([look])) as { looks: { settings: { notes: object } }[] }
    Object.assign(file.looks[0]!.settings.notes, { paletteSaved: { name: 'x', colours: [1] } })
    const back = read(file, new Map([[ID, 'custom-b']]))
    expect(back.values['notes.paletteSaved']).toBeNull()
    expect(back.values['notes.palette']).toBe('custom-b')
    expect(colours(back)).toEqual(colours(BUILT_IN_LOOKS[0]!))
  })

  it('is not modified by editing its set', () => {
    const settings = restoreValues(
      lookSettings(DEFAULT_SETTINGS, look),
      new Map([['notes.paletteSaved', { name: 'x', colours: twelve('#999999') }]]),
    )
    expect(isLookModified(settings, look)).toBe(false)
  })

  it('compares the copies of two looks only while the set is missing', () => {
    const other = withSavedColours(look, setsWith('#444444'))
    const merge = (sets = EMPTY_COLOUR_SETS) => mergeLooks([other], [look], () => 'n', true, sets)
    expect(merge(setsWith('#555555')).skipped).toBe(1)
    expect(merge().skipped).toBe(0)
  })

  it('leaves every built-in look’s colours as they were', () => {
    for (const l of BUILT_IN_LOOKS) {
      const { notes } = lookSettings(DEFAULT_SETTINGS, l)
      expect(colours(l)).toEqual(basePaletteColors(notes.palette as NotePalette, notes))
    }
  })
})

describe('settings v11', () => {
  const sets = { overrides: { warm: { 0: '#ABCDEF' } }, custom: setsWith('#111111').custom }

  it('round-trips a custom set id, its copy and the sets', () => {
    const settings = lookSettings(DEFAULT_SETTINGS, look)
    const raw = json(storedSettings(settings, {}, undefined, 'desktop', sets))
    expect(loadSettings(raw).notes).toEqual(settings.notes)
    expect(loadColourSets(raw)).toEqual(sets)
  })

  it('starts from v10 with no sets and the same palette', () => {
    const raw = { version: 10, settings: { notes: { palette: 'neon' } }, noteColourSets: sets }
    expect(loadSettings(raw).notes).toMatchObject({ palette: 'neon', paletteSaved: null })
    expect(loadColourSets(raw)).toEqual(EMPTY_COLOUR_SETS)
  })

  it('counts a chosen custom set as one change', () => {
    const settings = lookSettings(DEFAULT_SETTINGS, look)
    expect(changedCount(settings, { kind: 'section', id: 'notes' })).toBe(1)
  })
})
