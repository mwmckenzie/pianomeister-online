import { describe, expect, it } from 'vitest'

import { isTypingTarget } from './isTypingTarget'

function element(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.firstElementChild as HTMLElement
}

describe('isTypingTarget', () => {
  it('is true for text fields, text areas, selects, combo boxes and editable content', () => {
    expect(isTypingTarget(element('<input type="text">'))).toBe(true)
    expect(isTypingTarget(element('<input type="search">'))).toBe(true)
    expect(isTypingTarget(element('<input type="number">'))).toBe(true)
    expect(isTypingTarget(element('<textarea></textarea>'))).toBe(true)
    expect(isTypingTarget(element('<select></select>'))).toBe(true)
    expect(isTypingTarget(element('<div role="combobox"><span>x</span></div>'))).toBe(true)
    const editable = element('<div contenteditable="true"></div>')
    // jsdom doesn't compute isContentEditable.
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    expect(isTypingTarget(editable)).toBe(true)
  })

  it('is false for buttons, sliders, checkboxes and the page', () => {
    expect(isTypingTarget(element('<button>b</button>'))).toBe(false)
    expect(isTypingTarget(element('<input type="range">'))).toBe(false)
    expect(isTypingTarget(element('<input type="checkbox">'))).toBe(false)
    expect(isTypingTarget(document.body)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
