// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import { disabledHintOf } from './disabledHintOf'
import type { PlayerSettings } from './PlayerSettings'
import { settingDefinition } from './settingValues'

const withNames = (names: Partial<PlayerSettings['names']>): PlayerSettings => ({
  ...DEFAULT_SETTINGS,
  names: { ...DEFAULT_SETTINGS.names, ...names },
})

describe('disabledHintOf', () => {
  it('reads a fixed hint', () => {
    expect(disabledHintOf(settingDefinition('render.bloomStrength'), DEFAULT_SETTINGS)).toBe(
      'Needs bloom (quality Low or higher)',
    )
  })

  it('names only the root cause when one reason implies another', () => {
    const offset = settingDefinition('names.offset')
    expect(disabledHintOf(offset, withNames({ mode: 'off' }))).toBe('Needs note names on')
    expect(disabledHintOf(offset, withNames({ mode: 'keys' }))).toBe(
      'Needs note names on notes (Notes or Both)',
    )
    const height = settingDefinition('names.height')
    expect(disabledHintOf(height, withNames({ mode: 'off' }))).toBe('Needs note names on')
    expect(disabledHintOf(height, withNames({ mode: 'notes', style: 'flat' }))).toBe(
      'Needs labels facing the camera',
    )
    const keySize = settingDefinition('names.keySize')
    expect(disabledHintOf(keySize, withNames({ mode: 'off' }))).toBe('Needs note names on')
    expect(disabledHintOf(keySize, withNames({ mode: 'notes' }))).toBe(
      'Needs note names on keys (Keys or Both)',
    )
  })

  it('has no hint for an always-enabled setting', () => {
    expect(disabledHintOf(settingDefinition('names.mode'), DEFAULT_SETTINGS)).toBeNull()
  })
})
