import { afterEach, describe, expect, it } from 'vitest'

import { effectiveBindings } from '@/core/commands/shortcutBindings'

import { keyCapture } from './keyCapture'
import { pageListCommand } from './pageListCommand'

const BINDINGS = effectiveBindings({})

function element(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.firstElementChild as HTMLElement
}

/** Dispatches a key press at `target` and returns the command the page would run. */
function press(target: HTMLElement, key: string, code: string, shiftKey = false): string | null {
  let result: string | null = null
  const listener = (event: KeyboardEvent) => (result = pageListCommand(event, BINDINGS))
  window.addEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown', { key, code, shiftKey, bubbles: true }))
  window.removeEventListener('keydown', listener)
  return result
}

afterEach(() => {
  document.body.innerHTML = ''
  keyCapture.value = false
})

describe('pageListCommand', () => {
  it('drives the lists by role wherever focus is', () => {
    expect(press(document.body, 'ArrowDown', 'ArrowDown')).toBe('listNext')
    expect(press(document.body, 'ArrowDown', 'ArrowDown', true)).toBe('secondaryNext')
    expect(press(document.body, 'Enter', 'Enter')).toBe('listOpen')
    expect(press(document.body, ']', 'BracketRight')).toBe('nextTab')
  })

  it('passes keys that type nothing on from a page search field, never characters', () => {
    const search = element('<input type="search" data-list-search>')
    expect(press(search, 'ArrowDown', 'ArrowDown')).toBe('listNext')
    expect(press(search, 'ArrowUp', 'ArrowUp', true)).toBe('secondaryPrevious')
    expect(press(search, 'Enter', 'Enter')).toBe('listOpen')
    expect(press(search, ']', 'BracketRight')).toBeNull()
    // ←/→ move the caret.
    expect(press(search, 'ArrowRight', 'ArrowRight')).toBeNull()
    // Any other text field keeps every key.
    expect(press(element('<input type="text">'), 'ArrowDown', 'ArrowDown')).toBeNull()
  })

  it('leaves arrows to a focused control that uses them, and Enter to buttons', () => {
    const slider = element('<span role="slider" tabindex="0"></span>')
    expect(press(slider, 'ArrowDown', 'ArrowDown')).toBeNull()
    expect(press(slider, ']', 'BracketRight')).toBe('nextTab')
    const segmented = element('<div data-owns-arrows><button>a</button></div>')
    expect(press(segmented.querySelector('button')!, 'ArrowUp', 'ArrowUp', true)).toBeNull()
    const button = element('<button>Export</button>')
    expect(press(button, 'Enter', 'Enter')).toBeNull()
    expect(press(button, 'ArrowDown', 'ArrowDown')).toBe('listNext')
    const row = element('<button data-list-row>Opening</button>')
    expect(press(row, 'Enter', 'Enter')).toBe('listOpen')
  })

  it('stands aside while a key is recorded or another dialog is open', () => {
    keyCapture.value = true
    expect(press(document.body, 'ArrowDown', 'ArrowDown')).toBeNull()
    keyCapture.value = false
    element('<div role="dialog" data-state="open"></div>')
    expect(press(document.body, 'ArrowDown', 'ArrowDown')).toBeNull()
  })
})
