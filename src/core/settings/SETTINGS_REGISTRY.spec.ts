// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { constrainKeyboard } from './constrainKeyboard'
import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import { loadSettings, storedSettings } from './loadSettings'
import type { SettingKey } from './SettingKey'
import { SETTING_KEYS } from './SETTING_KEYS'
import { settingGroupKeys } from './settingGroups'
import { SETTINGS_LAYOUT } from './SETTINGS_LAYOUT'
import { readSetting, settingDefinition } from './settingValues'

const COLOR = /^#[0-9A-F]{6}$/

function isValidDefinition(key: SettingKey): boolean {
  const def = settingDefinition(key)
  if (def.label === '') return false
  switch (def.kind) {
    case 'number':
      return def.min < def.max && def.step > 0 && def.default >= def.min && def.default <= def.max
    case 'choice':
      return def.options.some((o) => o.value === def.default)
    case 'color':
      return COLOR.test(def.default)
    case 'boolean':
      return typeof def.default === 'boolean'
  }
}

describe('SETTINGS_REGISTRY', () => {
  it('declares every setting with a valid default within its limits', () => {
    expect(SETTING_KEYS.length).toBeGreaterThan(60)
    const problems = SETTING_KEYS.filter((key) => !isValidDefinition(key))
    expect(problems).toEqual([])
  })

  it('gives the defaults that load and survive the cross-setting limits unchanged', () => {
    expect(loadSettings(JSON.parse(JSON.stringify(storedSettings(DEFAULT_SETTINGS))))).toEqual(
      DEFAULT_SETTINGS,
    )
    expect(constrainKeyboard(DEFAULT_SETTINGS.keyboard)).toBe(DEFAULT_SETTINGS.keyboard)
    const differing = SETTING_KEYS.filter(
      (key) => readSetting(DEFAULT_SETTINGS, key) !== settingDefinition(key).default,
    )
    expect(differing).toEqual([])
  })

  it('says why a setting is disabled wherever it can be', () => {
    const missing = SETTING_KEYS.filter((key) => {
      const def = settingDefinition(key)
      return def.enabled !== undefined && (def.disabledHint ?? '').trim() === ''
    })
    expect(missing).toEqual([])
  })

  it('places every setting in a section the layout shows', () => {
    const sidebar = new Set<string>(SETTINGS_LAYOUT.sidebar.map((s) => s.id))
    const tabs = new Map<string, Set<string>>(
      SETTINGS_LAYOUT.tabs.map((t) => [t.id, new Set<string>(t.sections.map((s) => s.id))]),
    )
    const homeless = SETTING_KEYS.filter((key) => {
      const home = settingDefinition(key).home
      return home.area === 'sidebar'
        ? !sidebar.has(home.section)
        : tabs.get(home.tab)?.has(home.section) !== true
    })
    expect(homeless).toEqual([])
  })

  it('derives groups: sections, tabs and the sidebar partition the settings', () => {
    const sidebar = settingGroupKeys({ kind: 'sidebar' })
    const tabs = SETTINGS_LAYOUT.tabs.flatMap((t) => settingGroupKeys({ kind: 'tab', id: t.id }))
    expect([...sidebar, ...tabs].sort()).toEqual([...SETTING_KEYS].sort())

    const sections = [
      ...SETTINGS_LAYOUT.sidebar.map((s) => s.id),
      ...SETTINGS_LAYOUT.tabs.flatMap((t) => t.sections.map((s) => s.id)),
    ]
    expect(new Set(sections).size).toBe(sections.length)
    const empty = sections.filter((id) => settingGroupKeys({ kind: 'section', id }).length === 0)
    expect(empty).toEqual([])

    expect(settingGroupKeys({ kind: 'section', id: 'camera' })).toEqual([
      'camera.tiltDeg',
      'camera.distanceOffset',
      'camera.pan',
    ])
    expect(settingGroupKeys({ kind: 'tab', id: 'practice' })).toEqual([
      'practice.tempoStep',
      'practice.preRollBeats',
      'practice.preRollMode',
    ])
    // The keyboard section is purely dimensional ("Reset keyboard to grand piano").
    expect(
      settingGroupKeys({ kind: 'section', id: 'keyboard' }).every((k) => k.startsWith('keyboard.')),
    ).toBe(true)
    expect(sidebar).toContain('keys.fadeBeats')
    expect(sidebar).not.toContain('audio.master')
  })

  it('keeps the brief defaults for the new sections', () => {
    expect(DEFAULT_SETTINGS.appearance).toEqual({
      primary: '#8AB4FF',
      secondary: '#7EE0C3',
      panelOpacity: 0.58,
      blur: 26,
      motion: 'system',
      hideControls: true,
      hideControlsAfter: 3,
      startOn: 'welcome',
    })
    expect(DEFAULT_SETTINGS.audio).toMatchObject({
      master: 0.8,
      quietLevel: 0.25,
      metronomeMode: 'off',
      metronomeVolume: 0.6,
    })
    expect(DEFAULT_SETTINGS.practice).toEqual({
      tempoStep: 5,
      preRollBeats: 0,
      preRollMode: 'muted',
    })
  })
})
