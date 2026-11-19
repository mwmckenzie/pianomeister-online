// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { applyShortcutEdit } from './applyShortcutEdit'
import { COMMANDS } from './COMMANDS'
import { formatBinding } from './formatBinding'
import { metaKeyLabel } from './metaKeyLabel'
import { bindingFromEvent, charKey, codeKey, matchesEvent } from './keyBindings'
import type { KeyEventLike } from './KeyEventLike'
import { readShortcutOverrides } from './readShortcutOverrides'
import { reservedReason } from './reservedKeys'
import {
  commandForEvent,
  effectiveBindings,
  findConflicts,
  scopesConflict,
} from './shortcutBindings'

const press = (key: string, code: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
})

const DEFAULTS = effectiveBindings({})

describe('command registry', () => {
  it('has unique ids, a label and a description for each command', () => {
    const ids = COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of COMMANDS) {
      expect(c.label).not.toBe('')
      expect(c.description).not.toBe('')
      expect(c.keys.length).toBeLessThanOrEqual(2)
    }
  })

  it('has no conflicting default keys under the scope rules', () => {
    for (const c of COMMANDS) {
      for (const key of c.keys) {
        expect(findConflicts(DEFAULTS, key, c.scope, c.id), `${c.id} ${key.value}`).toEqual([])
      }
    }
  })

  it('has no reserved default keys except the fixed Close', () => {
    for (const c of COMMANDS) {
      const fixed = 'fixed' in c && c.fixed
      for (const key of c.keys) expect(reservedReason(key) !== null).toBe(fixed)
    }
  })
})

describe('matching (layout-aware)', () => {
  it('matches characters by what the key types, case-insensitively, Shift folded in', () => {
    const b = charKey('b')
    expect(matchesEvent(b, press('b', 'KeyB'))).toBe(true)
    expect(matchesEvent(b, press('B', 'KeyB', { shiftKey: true }))).toBe(true)
    // A layout where B sits elsewhere: the character decides.
    expect(matchesEvent(b, press('b', 'KeyN'))).toBe(true)
    expect(matchesEvent(b, press('b', 'KeyB', { ctrlKey: true }))).toBe(false)
  })

  it('works on a German keyboard: "?" is Shift+ß, "-" and "+" have their own keys', () => {
    expect(matchesEvent(charKey('?'), press('?', 'Minus', { shiftKey: true }))).toBe(true)
    expect(matchesEvent(charKey('-'), press('-', 'Slash'))).toBe(true)
    expect(matchesEvent(charKey('+'), press('+', 'BracketRight'))).toBe(true)
    // US: "+" is Shift+=, "=" alone is Tempo up's second key.
    expect(matchesEvent(charKey('+'), press('+', 'Equal', { shiftKey: true }))).toBe(true)
    expect(matchesEvent(charKey(','), press(',', 'Comma'))).toBe(true)
  })

  it('matches physical keys with exactly their modifiers', () => {
    const space = codeKey('Space')
    expect(matchesEvent(space, press(' ', 'Space'))).toBe(true)
    expect(matchesEvent(space, press(' ', 'Space', { shiftKey: true }))).toBe(false)
    const combo = codeKey('KeyK', { ctrl: true, shift: true })
    expect(matchesEvent(combo, press('K', 'KeyK', { ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(matchesEvent(combo, press('k', 'KeyK', { ctrlKey: true }))).toBe(false)
  })

  it('records what decision 87 says: characters, or physical keys with modifiers', () => {
    expect(bindingFromEvent(press('K', 'KeyK', { shiftKey: true }))).toEqual(charKey('k'))
    expect(bindingFromEvent(press('?', 'Minus', { shiftKey: true }))).toEqual(charKey('?'))
    expect(bindingFromEvent(press(' ', 'Space'))).toEqual(codeKey('Space'))
    expect(bindingFromEvent(press('ArrowUp', 'ArrowUp'))).toEqual(codeKey('ArrowUp'))
    expect(bindingFromEvent(press('k', 'KeyK', { ctrlKey: true, shiftKey: true }))).toEqual(
      codeKey('KeyK', { ctrl: true, shift: true }),
    )
    // AltGr (Ctrl+Alt) on a German keyboard records the physical combo.
    expect(bindingFromEvent(press('@', 'KeyQ', { ctrlKey: true, altKey: true }))).toEqual(
      codeKey('KeyQ', { ctrl: true, alt: true }),
    )
    // A modifier alone is no key.
    expect(bindingFromEvent(press('Shift', 'ShiftLeft', { shiftKey: true }))).toBeNull()
    expect(bindingFromEvent(press('Control', 'ControlLeft', { ctrlKey: true }))).toBeNull()
  })

  it('finds the command for a key press in its scope', () => {
    expect(commandForEvent(DEFAULTS, 'player', press(' ', 'Space'))).toBe('playPause')
    expect(commandForEvent(DEFAULTS, 'player', press('B', 'KeyB', { shiftKey: true }))).toBe(
      'saveBookmark',
    )
    expect(commandForEvent(DEFAULTS, 'player', press('=', 'Equal'))).toBe('tempoUp')
    expect(commandForEvent(DEFAULTS, 'lists', press('ArrowLeft', 'ArrowLeft'))).toBe(
      'listFocusPrevious',
    )
    expect(commandForEvent(DEFAULTS, 'player', press('ArrowLeft', 'ArrowLeft'))).toBe('previousBar')
    expect(commandForEvent(DEFAULTS, 'app', press('?', 'Slash', { shiftKey: true }))).toBe(
      'showShortcuts',
    )
    expect(commandForEvent(DEFAULTS, 'player', press('z', 'KeyZ'))).toBeNull()
    // Shift+↓ is its own key: the side list, not the main one.
    expect(
      commandForEvent(DEFAULTS, 'lists', press('ArrowDown', 'ArrowDown', { shiftKey: true })),
    ).toBe('secondaryNext')
    expect(commandForEvent(DEFAULTS, 'lists', press('ArrowDown', 'ArrowDown'))).toBe('listNext')
    expect(commandForEvent(DEFAULTS, 'tabs', press(']', 'BracketRight'))).toBe('nextTab')
  })
})

describe('AltGr characters (German layout)', () => {
  const altGr = (key: string, code: string) => press(key, code, { ctrlKey: true, altKey: true })

  it('match character bindings: [ ] by default, { } @ when bound', () => {
    expect(commandForEvent(DEFAULTS, 'tabs', altGr('[', 'Digit8'))).toBe('previousTab')
    expect(commandForEvent(DEFAULTS, 'tabs', altGr(']', 'Digit9'))).toBe('nextTab')
    const bound = effectiveBindings({
      toggleMetronome: [charKey('@')],
      openPicker: [charKey('{')],
      openLibrary: [charKey('}')],
    })
    expect(commandForEvent(bound, 'player', altGr('@', 'KeyQ'))).toBe('toggleMetronome')
    expect(commandForEvent(bound, 'player', altGr('{', 'Digit7'))).toBe('openPicker')
    expect(commandForEvent(bound, 'player', altGr('}', 'Digit0'))).toBe('openLibrary')
  })

  it('come after a Ctrl+Alt combo the user recorded', () => {
    const bound = effectiveBindings({
      toggleMetronome: [charKey('@')],
      saveBookmark: [codeKey('KeyQ', { ctrl: true, alt: true })],
    })
    expect(commandForEvent(bound, 'player', altGr('@', 'KeyQ'))).toBe('saveBookmark')
    // Ctrl+Alt that types nothing printable is only ever a combo.
    expect(commandForEvent(DEFAULTS, 'tabs', altGr('Dead', 'BracketRight'))).toBeNull()
    // Meta+[ isn't AltGr.
    expect(
      commandForEvent(DEFAULTS, 'tabs', press('[', 'BracketLeft', { metaKey: true })),
    ).toBeNull()
  })
})

describe('reserved keys', () => {
  it('refuses Esc, Tab and browser keys, with a reason', () => {
    expect(reservedReason(codeKey('Escape'))).toBe('Esc is reserved for closing')
    expect(reservedReason(codeKey('Tab'))).toBe('Tab moves focus')
    expect(reservedReason(codeKey('Tab', { shift: true }))).toBe('Tab moves focus')
    expect(reservedReason(codeKey('KeyW', { ctrl: true }))).toBe('Ctrl+W is used by the browser')
    expect(reservedReason(codeKey('KeyT', { meta: true }))).toBe('Meta+T is used by the browser')
    expect(reservedReason(codeKey('Tab', { ctrl: true }))).toBe('Ctrl+Tab is used by the browser')
    expect(reservedReason(codeKey('F5'))).toBe('F5 is used by the browser')
    expect(reservedReason(codeKey('F11'))).toBe('F11 is used by the browser')
    expect(reservedReason(codeKey('F4', { alt: true }))).toBe('Alt+F4 closes the window')
  })

  it('allows ordinary keys and combos', () => {
    expect(reservedReason(charKey('k'))).toBeNull()
    expect(reservedReason(codeKey('KeyK', { ctrl: true }))).toBeNull()
    expect(reservedReason(codeKey('F6'))).toBeNull()
    expect(reservedReason(codeKey('KeyW'))).toBeNull()
  })
})

describe('conflicts across scopes', () => {
  it('follows decision 86: player and lists apart; dialogs and app against everything', () => {
    expect(scopesConflict('player', 'lists')).toBe(false)
    expect(scopesConflict('player', 'player')).toBe(true)
    expect(scopesConflict('dialogs', 'player')).toBe(true)
    expect(scopesConflict('lists', 'dialogs')).toBe(true)
    expect(scopesConflict('app', 'lists')).toBe(true)
  })

  it('runs tabs with lists and dialogs, never with the player', () => {
    expect(scopesConflict('tabs', 'lists')).toBe(true)
    expect(scopesConflict('lists', 'tabs')).toBe(true)
    expect(scopesConflict('tabs', 'dialogs')).toBe(true)
    expect(scopesConflict('tabs', 'app')).toBe(true)
    expect(scopesConflict('tabs', 'player')).toBe(false)
    // "]" is free for a player command, but taken for a list command.
    expect(findConflicts(DEFAULTS, charKey(']'), 'player')).toEqual([])
    expect(findConflicts(DEFAULTS, charKey(']'), 'lists')).toEqual(['nextTab'])
  })

  it('names who already uses a key', () => {
    expect(findConflicts(DEFAULTS, charKey('m'), 'player', 'playPause')).toEqual([
      'toggleMetronome',
    ])
    // ← is free for lists' own use, but taken in the player.
    expect(findConflicts(DEFAULTS, codeKey('ArrowLeft'), 'player', 'stop')).toEqual(['previousBar'])
    // "?" (app) clashes with a player key.
    expect(findConflicts(DEFAULTS, charKey('?'), 'player', 'stop')).toEqual(['showShortcuts'])
    expect(findConflicts(DEFAULTS, charKey('k'), 'player')).toEqual([])
  })
})

describe('applyShortcutEdit', () => {
  it('records a key, adds a second, removes one, and keeps the previous for Undo', () => {
    const k = charKey('k')
    const one = applyShortcutEdit({}, { type: 'set', id: 'playPause', index: 0, binding: k })
    expect(one.overrides).toEqual({ playPause: [k] })
    expect(one.previous).toEqual({})
    const two = applyShortcutEdit(one.overrides, {
      type: 'set',
      id: 'playPause',
      index: 1,
      binding: codeKey('Space'),
    })
    expect(two.overrides.playPause).toEqual([k, codeKey('Space')])
    const removed = applyShortcutEdit(two.overrides, { type: 'remove', id: 'playPause', index: 0 })
    // Back to just Space: the default, so no override.
    expect(removed.overrides).toEqual({})
  })

  it('allows no key at all, and never more than two', () => {
    const none = applyShortcutEdit({}, { type: 'remove', id: 'stop', index: 0 })
    expect(none.overrides).toEqual({ stop: [] })
    expect(effectiveBindings(none.overrides).get('stop')).toEqual([])
    const three = applyShortcutEdit(
      {},
      {
        type: 'set',
        id: 'tempoUp',
        index: 2,
        binding: charKey('u'),
      },
    )
    // A third key is dropped: the command keeps its two.
    expect(effectiveBindings(three.overrides).get('tempoUp')).toHaveLength(2)
  })

  it('Replace moves the key from the other command', () => {
    const { overrides } = applyShortcutEdit(
      {},
      {
        type: 'replace',
        id: 'playPause',
        index: 0,
        binding: charKey('m'),
        from: 'toggleMetronome',
      },
    )
    expect(overrides).toEqual({ playPause: [charKey('m')], toggleMetronome: [] })
  })

  it('resets one command or all, and never edits a fixed command', () => {
    const edited = { playPause: [charKey('k')], stop: [] }
    expect(applyShortcutEdit(edited, { type: 'reset', id: 'stop' }).overrides).toEqual({
      playPause: [charKey('k')],
    })
    const all = applyShortcutEdit(edited, { type: 'resetAll' })
    expect(all.overrides).toEqual({})
    expect(all.previous).toBe(edited)
    expect(
      applyShortcutEdit({}, { type: 'set', id: 'closeDialog', index: 0, binding: charKey('x') })
        .overrides,
    ).toEqual({})
  })
})

describe('formatBinding', () => {
  it('writes keys the way the UI shows them', () => {
    expect(formatBinding(charKey('b'))).toBe('B')
    expect(formatBinding(charKey('?'))).toBe('?')
    expect(formatBinding(charKey(','))).toBe(',')
    expect(formatBinding(codeKey('Space'))).toBe('Space')
    expect(formatBinding(codeKey('ArrowLeft'))).toBe('←')
    expect(formatBinding(codeKey('Home'))).toBe('Home')
    expect(formatBinding(codeKey('KeyK', { ctrl: true, shift: true }))).toBe('Ctrl+Shift+K')
    expect(formatBinding(codeKey('Slash', { ctrl: true }))).toBe('Ctrl+/')
  })

  it('names physical keys by the user layout when it is known', () => {
    const german = new Map([
      ['KeyY', 'z'],
      ['Slash', '-'],
    ])
    expect(formatBinding(codeKey('KeyY', { ctrl: true }), german)).toBe('Ctrl+Z')
    expect(formatBinding(codeKey('KeyY', { ctrl: true }))).toBe('Ctrl+Y')
    expect(formatBinding(codeKey('Slash', { alt: true }), german)).toBe('Alt+-')
  })
})

describe('metaKeyLabel', () => {
  it('names Meta per platform: ⌘ on Apple, Win on Windows, Meta elsewhere', () => {
    expect(metaKeyLabel('macOS')).toBe('⌘')
    expect(metaKeyLabel('MacIntel')).toBe('⌘')
    expect(metaKeyLabel('iPad')).toBe('⌘')
    expect(metaKeyLabel('iPhone')).toBe('⌘')
    expect(metaKeyLabel('Windows')).toBe('Win')
    expect(metaKeyLabel('Win32')).toBe('Win')
    expect(metaKeyLabel('Linux x86_64')).toBe('Meta')
    expect(metaKeyLabel('Chrome OS')).toBe('Meta')
    expect(metaKeyLabel('')).toBe('Meta')
  })

  it('is used in labels and reserved-key messages; Ctrl stays Ctrl', () => {
    const combo = codeKey('KeyK', { ctrl: true, meta: true })
    expect(formatBinding(combo, undefined, '⌘')).toBe('Ctrl+⌘+K')
    expect(formatBinding(combo, undefined, 'Win')).toBe('Ctrl+Win+K')
    expect(formatBinding(combo)).toBe('Ctrl+Meta+K')
    const format = (b: Parameters<typeof formatBinding>[0]) => formatBinding(b, undefined, '⌘')
    expect(reservedReason(codeKey('KeyW', { meta: true }), format)).toBe(
      '⌘+W is used by the browser',
    )
  })
})

describe('readShortcutOverrides', () => {
  it('keeps valid overrides and drops the rest', () => {
    const read = readShortcutOverrides({
      playPause: [
        { kind: 'key', match: 'char', value: 'K', ctrl: true },
        { kind: 'key', match: 'code', value: 'Space' },
        { kind: 'key', match: 'code', value: 'F6' },
      ],
      stop: [],
      closeDialog: [{ kind: 'key', match: 'char', value: 'x' }],
      unknown: [{ kind: 'key', match: 'char', value: 'x' }],
      nextBar: [{ kind: 'midi', note: 64 }, 'nope'],
    })
    expect(read).toEqual({
      playPause: [charKey('k'), codeKey('Space')],
      stop: [],
      nextBar: [],
    })
    expect(readShortcutOverrides('junk')).toEqual({})
  })
})
