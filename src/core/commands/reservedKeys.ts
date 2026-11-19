import type { Binding } from './Binding'
import { formatBinding } from './formatBinding'

/** Ctrl/Meta + these keys belong to the browser or the system (close, new tab, quit…). */
const BROWSER_COMBO_CODES = new Set(['KeyW', 'KeyT', 'KeyN', 'KeyQ', 'KeyR', 'KeyL', 'Tab', 'F4'])
/** These belong to the browser with or without modifiers (reload, full screen, dev tools). */
const BROWSER_KEYS = new Set(['F5', 'F11', 'F12'])

/**
 * Why a key can't be a shortcut, or null if it can (brief decision 85): Esc closes, Tab moves
 * focus, and some keys and combos belong to the browser or the system.
 */
export function reservedReason(
  binding: Binding,
  format: (binding: Binding) => string = formatBinding,
): string | null {
  if (binding.match !== 'code') return null
  const { value } = binding
  if (value === 'Escape') return 'Esc is reserved for closing'
  if (value === 'Tab' && !binding.ctrl && !binding.meta && !binding.alt) return 'Tab moves focus'
  if (BROWSER_KEYS.has(value)) return `${format(binding)} is used by the browser`
  if ((binding.ctrl || binding.meta) && BROWSER_COMBO_CODES.has(value))
    return `${format(binding)} is used by the browser`
  if (binding.alt && value === 'F4') return 'Alt+F4 closes the window'
  return null
}
