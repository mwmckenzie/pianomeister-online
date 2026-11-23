// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { EMPTY_LOOKS } from './EMPTY_LOOKS'
import { LOOK_KEYS } from './LOOK_KEYS'
import { captureLook } from './lookValues'
import { readLooks } from './readLooks'

const NOW = '2026-11-22T10:00:00.000Z'

describe('readLooks (looks kept in localStorage before milestone 9.1)', () => {
  it('reads nothing from garbage', () => {
    expect(readLooks(null)).toEqual(EMPTY_LOOKS)
    expect(readLooks({ saved: 'x' })).toEqual(EMPTY_LOOKS)
  })

  it('coerces values, fills every other look key from defaults, drops unknown keys', () => {
    const state = readLooks(
      {
        active: 'a',
        saved: [
          {
            id: 'a',
            name: '  Ember  ',
            values: { 'lines.nowGlow': 99, 'colors.background': 'red', 'audio.master': 0.2 },
          },
        ],
      },
      undefined,
      NOW,
    )
    const look = state.saved[0]!
    expect(state.active).toBe('a')
    expect(look).toMatchObject({ name: 'Ember', builtIn: false, createdAt: NOW })
    expect(look.values['lines.nowGlow']).toBe(3)
    expect(look.values['colors.background']).toBe(DEFAULT_SETTINGS.colors.background)
    // Old looks were appearance only: the camera comes from the defaults, once, at the move.
    expect(look.values['camera.tiltDeg']).toBe(DEFAULT_SETTINGS.camera.tiltDeg)
    expect(Object.keys(look.values).sort()).toEqual([...LOOK_KEYS].sort())
  })

  it('skips malformed entries and duplicate or built-in ids', () => {
    const ok = captureLook(DEFAULT_SETTINGS, 'a', 'A')
    const state = readLooks({
      saved: [
        ok,
        { ...ok, name: 'Again' },
        { id: 'builtin:classic', name: 'Fake' },
        7,
        { id: 'b' },
      ],
    })
    expect(state.saved.map((l) => l.name)).toEqual(['A'])
  })

  it('keeps the active id as stored (it may name a look already in the database)', () => {
    expect(readLooks({ active: 'builtin:classic' }).active).toBe('builtin:classic')
    expect(readLooks({ active: 'db-look' }).active).toBe('db-look')
  })
})
