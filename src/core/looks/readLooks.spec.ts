// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { EMPTY_LOOKS } from './EMPTY_LOOKS'
import { captureLook } from './lookValues'
import { readLooks } from './readLooks'

describe('readLooks', () => {
  it('reads nothing from garbage', () => {
    expect(readLooks(null)).toEqual(EMPTY_LOOKS)
    expect(readLooks({ saved: 'x' })).toEqual(EMPTY_LOOKS)
  })

  it('coerces values, fills missing ones with defaults and drops unknown keys', () => {
    const state = readLooks({
      active: 'a',
      saved: [
        {
          id: 'a',
          name: '  Ember  ',
          values: { 'lines.nowGlow': 99, 'colors.background': 'red', 'camera.tiltDeg': 10 },
        },
      ],
    })
    const look = state.saved[0]!
    expect(state.active).toBe('a')
    expect(look.name).toBe('Ember')
    expect(look.builtIn).toBe(false)
    expect(look.values['lines.nowGlow']).toBe(3)
    expect(look.values['colors.background']).toBe(DEFAULT_SETTINGS.colors.background)
    expect(look.values['noteStyle.headFill']).toBe('solid')
    expect('camera.tiltDeg' in look.values).toBe(false)
  })

  it('skips malformed entries and duplicate or built-in ids', () => {
    const ok = captureLook(DEFAULT_SETTINGS, 'a', 'A')
    const state = readLooks({
      active: 'missing',
      saved: [
        ok,
        { ...ok, name: 'Again' },
        { id: 'builtin:classic', name: 'Fake' },
        7,
        { id: 'b' },
      ],
    })
    expect(state.saved.map((l) => l.name)).toEqual(['A'])
    expect(state.active).toBeNull()
  })

  it('keeps a built-in look as the active one', () => {
    expect(readLooks({ active: 'builtin:classic', saved: [] }).active).toBe('builtin:classic')
  })
})
