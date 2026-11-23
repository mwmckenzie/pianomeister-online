// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { SETTINGS_VERSION } from '../settings/loadSettings'
import { readSetting, withSetting } from '../settings/settingValues'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import type { Look } from './Look'
import { LOOK_KEYS } from './LOOK_KEYS'
import { captureLook, lookSettings, sameLookValues } from './lookValues'
import { readLookFile } from './readLookFile'
import { toLookFile } from './toLookFile'

const NOW = '2026-11-22T10:00:00.000Z'

function ids(): () => string {
  let n = 0
  return () => `new-${++n}`
}

function looksOf(raw: unknown, existing: readonly Look[] = []): readonly Look[] {
  const result = readLookFile(raw, existing, ids(), NOW)
  if (!result.ok) throw new Error(result.error)
  return result.looks
}

const file = (looks: unknown[], version = SETTINGS_VERSION) => ({
  format: 'pianomeister-look',
  version,
  looks,
})

describe('readLookFile', () => {
  it('round-trips: export then import gives the same picture', () => {
    const custom = withSetting(
      withSetting(DEFAULT_SETTINGS, 'lines.nowStyle', 'neon'),
      'camera.tiltDeg',
      60,
    )
    const look = captureLook(custom, 'look-a', 'Synth', NOW)
    const [back] = looksOf(JSON.parse(JSON.stringify(toLookFile([look]))))
    expect(back).toMatchObject({ id: 'look-a', name: 'Synth', createdAt: NOW, builtIn: false })
    expect(sameLookValues(back!, look)).toBe(true)
    const applied = lookSettings(DEFAULT_SETTINGS, back!)
    for (const key of LOOK_KEYS) expect(readSetting(applied, key)).toEqual(readSetting(custom, key))
  })

  it('validates like stored settings: clamps, drops unknown and cost keys, defaults wrong types', () => {
    const [look] = looksOf(
      file([
        {
          id: 'x',
          name: 'Loud',
          createdAt: 'not a date',
          settings: {
            lines: { nowGlow: 99, nowStyle: 'laser', mystery: 1 },
            camera: { tiltDeg: 'steep' },
            render: { quality: 'high', bloomStrength: -5 },
            nope: { a: 1 },
          },
        },
      ]),
    )
    expect(look!.values).toEqual({
      'lines.nowGlow': 3,
      'lines.nowStyle': DEFAULT_SETTINGS.lines.nowStyle,
      'camera.tiltDeg': DEFAULT_SETTINGS.camera.tiltDeg,
      'render.bloomStrength': 0,
    })
    expect(look!.createdAt).toBe(NOW)
  })

  it('leaves missing keys out, so they take the default when applied', () => {
    const [look] = looksOf(file([{ id: 'x', name: 'Bare', settings: {} }]))
    expect(look!.values).toEqual({})
  })

  it('migrates a look written by an older version', () => {
    const [look] = looksOf(
      file(
        [
          {
            id: 'old',
            name: 'Old',
            settings: { noteStyle: { headFill: 'glass', stripeWidth: 0.8 } },
          },
        ],
        6,
      ),
    )
    expect(look!.values['noteStyle.headFill']).toBe('crystal')
    expect(look!.values['noteStyle.headStripeWidth']).toBe(0.8)
  })

  it('never overwrites: taken ids get new ones, taken names get "(2)", "(3)"', () => {
    const mine = captureLook(DEFAULT_SETTINGS, 'a', 'Synth')
    const looks = looksOf(
      file([
        { id: 'a', name: 'Synth', settings: {} },
        { id: 'a', name: 'Synth', settings: {} },
        { id: 'builtin:classic', name: 'Classic', settings: {} },
        { id: 'fresh', name: 'Fresh', settings: {} },
        { name: 'No id', settings: {} },
      ]),
      [mine],
    )
    expect(looks.map((l) => [l.id, l.name])).toEqual([
      ['new-1', 'Synth (2)'],
      ['new-2', 'Synth (3)'],
      ['new-3', 'Classic (2)'],
      ['fresh', 'Fresh'],
      ['new-4', 'No id'],
    ])
  })

  it('refuses what is not a look file, or one from a newer version', () => {
    const errorOf = (raw: unknown) => {
      const result = readLookFile(raw, [], ids(), NOW)
      return result.ok ? null : result.error
    }
    expect(errorOf(null)).toBe('notLookFile')
    expect(errorOf({ format: 'pianomeister-library', version: 1, looks: [] })).toBe('notLookFile')
    expect(errorOf({ format: 'pianomeister-look', version: '8', looks: [] })).toBe('notLookFile')
    expect(errorOf(file([], SETTINGS_VERSION + 1))).toBe('newer')
    expect(errorOf(file([{ name: '' }, 7, { name: 'x' }]))).toBe('empty')
  })

  it('reads a built-in exported as a file into a saved look', () => {
    const classic = BUILT_IN_LOOKS[0]!
    const [look] = looksOf(JSON.parse(JSON.stringify(toLookFile([classic]))))
    expect(look).toMatchObject({ builtIn: false, name: 'Classic (2)', id: 'new-1' })
    expect(sameLookValues(look!, classic)).toBe(true)
  })
})
