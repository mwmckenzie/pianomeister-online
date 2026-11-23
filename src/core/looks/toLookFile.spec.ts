// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { SETTINGS_VERSION } from '../settings/loadSettings'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import { COST_KEYS } from './COST_KEYS'
import { LOOK_KEYS } from './LOOK_KEYS'
import { captureLook } from './lookValues'
import { toLookFile } from './toLookFile'

const NOW = '2026-11-21T12:00:00.000Z'

describe('toLookFile', () => {
  it('writes the .pmlook.json format with values nested by section', () => {
    const file = toLookFile([captureLook(DEFAULT_SETTINGS, 'look:1', 'Night', NOW)])
    expect(file.format).toBe('pianomeister-look')
    expect(file.version).toBe(SETTINGS_VERSION)
    expect(file.looks).toHaveLength(1)
    const [entry] = file.looks
    expect(entry).toMatchObject({ id: 'look:1', name: 'Night', createdAt: NOW })
    expect(entry?.settings.lines?.nowStyle).toBe(DEFAULT_SETTINGS.lines.nowStyle)
    expect(entry?.settings.camera?.tiltDeg).toBe(DEFAULT_SETTINGS.camera.tiltDeg)
    const count = Object.values(entry?.settings ?? {}).reduce(
      (n, s) => n + Object.keys(s).length,
      0,
    )
    expect(count).toBe(LOOK_KEYS.length)
  })

  it('never writes device cost, even from a look that carries it', () => {
    const classic = BUILT_IN_LOOKS[0]!
    const greedy = { ...classic, values: { ...classic.values, 'render.quality': 'high' } }
    const [entry] = toLookFile([greedy]).looks
    for (const key of COST_KEYS) {
      expect(entry?.settings.render ?? {}).not.toHaveProperty(key.split('.')[1]!)
    }
  })

  it('round-trips through JSON', () => {
    const file = toLookFile([captureLook(DEFAULT_SETTINGS, 'look:2', 'A')])
    expect(JSON.parse(JSON.stringify(file))).toEqual(file)
  })
})
