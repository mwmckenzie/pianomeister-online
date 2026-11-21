// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { SETTINGS_VERSION } from '../settings/loadSettings'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import { LOOK_KEYS } from './LOOK_KEYS'
import { captureLook } from './lookValues'
import { toLookFile } from './toLookFile'

describe('toLookFile', () => {
  it('writes the .pmlook.json format with values nested by section', () => {
    const look = captureLook(DEFAULT_SETTINGS, 'look:1', 'Night')
    const file = toLookFile([{ look, createdAt: '2026-11-21T12:00:00.000Z' }])
    expect(file.format).toBe('pianomeister-look')
    expect(file.version).toBe(SETTINGS_VERSION)
    expect(file.looks).toHaveLength(1)
    const [entry] = file.looks
    expect(entry).toMatchObject({
      id: 'look:1',
      name: 'Night',
      createdAt: '2026-11-21T12:00:00.000Z',
    })
    expect(entry?.settings.lines?.nowStyle).toBe(DEFAULT_SETTINGS.lines.nowStyle)
    expect(entry?.settings.render?.bloomStrength).toBe(DEFAULT_SETTINGS.render.bloomStrength)
    const count = Object.values(entry?.settings ?? {}).reduce(
      (n, s) => n + Object.keys(s).length,
      0,
    )
    expect(count).toBe(LOOK_KEYS.length)
  })

  it('never writes device-cost settings', () => {
    const [entry] = toLookFile([{ look: BUILT_IN_LOOKS[0]!, createdAt: '' }]).looks
    for (const field of ['quality', 'bloomResolution', 'particleBudget', 'shaderDetail']) {
      expect(entry?.settings.render ?? {}).not.toHaveProperty(field)
    }
  })

  it('round-trips through JSON', () => {
    const look = captureLook(DEFAULT_SETTINGS, 'look:2', 'A')
    const file = toLookFile([{ look, createdAt: 'x' }])
    expect(JSON.parse(JSON.stringify(file))).toEqual(file)
  })
})
