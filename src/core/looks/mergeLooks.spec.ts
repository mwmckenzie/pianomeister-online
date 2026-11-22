// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { withSetting } from '../settings/settingValues'
import { captureLook } from './lookValues'
import { mergeLooks } from './mergeLooks'
import { uniqueLookName } from './uniqueLookName'

function ids(): () => string {
  let n = 0
  return () => `new-${++n}`
}

describe('mergeLooks (backup import)', () => {
  const mine = captureLook(DEFAULT_SETTINGS, 'a', 'Synth')
  const changed = captureLook(withSetting(DEFAULT_SETTINGS, 'lines.nowGlow', 2), 'a', 'Synth')
  const other = captureLook(DEFAULT_SETTINGS, 'b', 'Synth')

  it('skips identical looks, adds a changed one under a new id, never overwrites', () => {
    const { added, skipped } = mergeLooks([mine, changed, other], [mine], ids(), true)
    expect(skipped).toBe(1)
    expect(added.map((l) => [l.id, l.name])).toEqual([
      ['new-1', 'Synth (2)'],
      ['b', 'Synth (3)'],
    ])
  })

  it('without skipIdentical (file import) adds identical looks too', () => {
    const { added, skipped } = mergeLooks([mine], [mine], ids())
    expect(skipped).toBe(0)
    expect(added.map((l) => [l.id, l.name])).toEqual([['new-1', 'Synth (2)']])
  })
})

describe('uniqueLookName', () => {
  it('numbers taken names, ignoring case', () => {
    const taken = new Set(['night', 'night (2)'])
    expect(uniqueLookName('Day', taken)).toBe('Day')
    expect(uniqueLookName('Night', taken)).toBe('Night (3)')
  })
})
