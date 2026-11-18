// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { commandForKey, keyLabel, shortcutLabel } from './commandKeys'
import { COMMANDS } from './COMMANDS'

describe('command registry', () => {
  it('gives no two commands the same default key in one scope', () => {
    const seen = new Map<string, string>()
    for (const command of COMMANDS) {
      for (const key of command.keys) {
        const slot = `${command.scope} ${key}`
        expect(seen.get(slot), `${slot}: ${command.id}`).toBeUndefined()
        seen.set(slot, command.id)
      }
    }
  })

  it('has unique ids, each with a label and at least one key', () => {
    const ids = COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const command of COMMANDS) {
      expect(command.label).not.toBe('')
      expect(command.keys.length).toBeGreaterThan(0)
    }
  })

  it('finds the command for a key in its scope only', () => {
    expect(commandForKey('player', 'Space')).toBe('playPause')
    expect(commandForKey('player', 'KeyB')).toBe('saveBookmark')
    expect(commandForKey('player', 'KeyM')).toBe('toggleMetronome')
    expect(commandForKey('player', 'Home')).toBe('stop')
    expect(commandForKey('lists', 'ArrowLeft')).toBe('listFocusPrevious')
    expect(commandForKey('player', 'ArrowLeft')).toBe('previousBar')
    expect(commandForKey('lists', 'NumpadEnter')).toBe('listOpen')
    expect(commandForKey('dialogs', 'Escape')).toBe('closeDialog')
    expect(commandForKey('player', 'Escape')).toBeNull()
    expect(commandForKey('player', 'KeyZ')).toBeNull()
  })

  it('writes keys the way the UI shows them', () => {
    expect(keyLabel('KeyB')).toBe('B')
    expect(keyLabel('Digit3')).toBe('3')
    expect(keyLabel('Comma')).toBe(',')
    expect(keyLabel('ArrowLeft')).toBe('←')
    expect(keyLabel('Home')).toBe('Home')
    expect(shortcutLabel('openSettings')).toBe(',')
    expect(shortcutLabel('saveBookmark')).toBe('B')
  })
})
